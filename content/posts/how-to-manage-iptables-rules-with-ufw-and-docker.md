---
title       : How to manage IPTables rules with UFW and Docker
description : When using Docker, it has added a whole bunch of firewall rules by default. Let's UFW rules Docker.
---

When using Docker, it has added [a whole bunch of firewall rules by
default](https://docs.docker.com/network/iptables/).  These rules allow you to
intelligently route the host machine's ports to the right containers, but also
to allow exchanges between several networks (in a Swarm, for example). It is,
however, complicated to set up our own rules when Docker issues its own.

## Let's use UFW

[UFW](https://wiki.ubuntu.com/UncomplicatedFirewall?action=show&redirect=UbuntuFirewall)
is a very simple application to avoid putting your fingers in the complex
world of firewalls. With a few commands you can allow or block a port from one
IP to a new one.

Now, how's it going? Any rules you put in place will pass **after** the rules
put in place by Docker. So if you block port 80 using UFW, for example, the
containers will remain accessible. By default, the policy I like to use is the
following:

```bash
ufw allow ssh
ufw default deny incoming
ufw default allow outgoing
```

We block all incoming connections and allow all outgoing ones. I want to be in
control of everything that goes through the server.

## Execute UFW rules before those of Docker

There's a trick to it. Indeed, our objective here is to execute UFW rules before
Docker's. There is a chain in IPTables called `DOCKER-USER`, which allows
rules to be executed before generic container rules. However, UFW cannot
communicate with this chain, but only with `ufw-user-input` (in our case). So
let's start by resetting these rules each time UFW is restarted: modify the
`/etc/ufw/before.init` file to include the lines about the firewall :

```bash
set -e

box "$1" in
start)
    # typically required
    ;;
stop)
    iptables -F DOCKER-USER || true
    iptables -A DOCKER-USER -j RETURN || true
    iptables -X ufw-user-input || true
    # typically required
    ;;
status)
    # optional
    ;;
flush-all)
    # optional
    ;;
*)
    echo "'$1' not supported"
    echo "Usage: before.init {start|stop|flush-all|status}"
    ;;
```

Now you have to tell the firewall that the rules defined by UFW must be executed
**before** those of Docker. Let's add these lines to the `/etc/ufw/after.init`
file.

**Note that the `$INTERFACE` variable must be replaced with the name of the
primary host interface used by Docker (such as `eth0` or `eno1`).**

```bash
*filter
:DOCKER-USER - [0:0]
:ufw-user-input - [0:0]
:ufw-after-logging-forward - [0:0]

-A DOCKER-USER -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
-A DOCKER-USER -m conntrack --ctstate INVALID -j DROP
-A DOCKER-USER -i $INTERFACE -j ufw-user-input
-A DOCKER-USER -i $INTERFACE -j ufw-after-logging-forward
-A DOCKER-USER -i $INTERFACE -j DROP

COMMIT
```

Before restarting UFW, you must also allow primary connections to the server,
namely :

```bash
# Web
ufw allow web

# Docker Swarm cluster
# The ports used by Docker Swarm to communicate between the different nodes
ufw allow proto tcp from $SERVER1_IP to any port 2377,7946
ufw allow proto udp from $SERVER1_IP to any port 4789,7946
ufw allow proto tcp from $SERVER2_IP to any port 2377,7946
ufw allow proto udp from $SERVER2_IP to any port 4789,7946
# ...
```

We can restart `ufw` to take into account all the changes we have made. Be
careful not to restart `ufw` too soon, otherwise you won't have remote access to
the server (all ports will be closed if you didn't allow SSH).

```bash
ufw reload
```

You can easily do a test run, start a listening container on the host (port
8000, for example) and you should not have access to the service until you allow
the port using UFW. We now have complete control over our server.

## Bonus: Ansible

Here are some useful rules used to implement these rules automatically using
[Ansible](https://www.ansible.com/resources/get-started).

```yaml
---
- host: <redacted>
  become: true
  tasks:
    - name: install ufw
      apt: name={{ item }} state=present update_cache=yes
      with_items:
        - ufw

    - name: configure ufw defaults
      ufw: direction={{ item.direction }} policy={{ item.policy }}
      with_items:
        - { direction: 'incoming', policy: 'deny' }
        - { direction: 'outgoing', policy: 'allow' }
      notify:
        - restart ufw

    - name: configure ufw ports
      ufw: rule={{ item.rule }} port={{ item.port }} proto={{ item.proto }}
      with_items:
        - { rule: 'allow', port: '22', proto: 'tcp' }
        - { rule: 'allow', port: '80', proto: 'tcp' }
        - { rule: 'allow', port: '443', proto: 'tcp' }
      notify:
        - restart ufw

    # You should install Docker before this rule.
    - name: configure ufw before.init to remove existing rules
      blockinfile:
        path: /etc/ufw/before.init
        marker: "# {mark} ANSIBLE MANAGED BLOCK"
        insertafter: stop\)
        block: |
          iptables -F DOCKER-USER || true
          iptables -A DOCKER-USER -j RETURN || true
          iptables -X ufw-user-input || true

    - name: chmod /etc/ufw/before.init
      file:
        path: /etc/ufw/before.init
        state: touch
        mode: "a+x"

    - name: configure ufw to work with DOCKER-USER chain name
      blockinfile:
        path: /etc/ufw/after.rules
        marker: "# {mark} ANSIBLE MANAGED BLOCK (docker-user)"
        block: |
          *filter
          :DOCKER-USER - [0:0]
          :ufw-user-input - [0:0]
          :ufw-after-logging-forward - [0:0]

          -A DOCKER-USER -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
          -A DOCKER-USER -m conntrack --ctstate INVALID -j DROP
          -A DOCKER-USER -i {{ ansible_default_ipv4.interface }} -j ufw-user-input
          -A DOCKER-USER -i {{ ansible_default_ipv4.interface }} -j ufw-after-logging-forward
          -A DOCKER-USER -i {{ ansible_default_ipv4.interface }} -j DROP

          COMMIT

    # Optional
    - name: configure ufw ports for docker swarm (TCP)
      ufw: rule=allow src={{ hostvars[item]['ansible_default_ipv4']['address'] }} port=2377,7946 proto=tcp
      with_items: "{{ ansible_play_hosts | default(play_hosts) }}"
      notify: restart ufw

    # Optional
    - name: configure ufw ports for docker swarm (UDP)
      ufw: rule=allow src={{ hostvars[item]['ansible_default_ipv4']['address'] }} port=4789,7946 proto=udp
      with_items: "{{ ansible_play_hosts | default(play_hosts) }}"
      notify: restart ufw

  handlers:
    - name: restart ufw
      service: name=ufw state=restarted enabled=yes
```
