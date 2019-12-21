---
date        : 2019-12-01T18:30:20+01:00
title       : Active and passive FTP with Docker
description : FTPs are already boring enough to set up when you're behind a firewall. But when you try to set up a FTP with Docker, it's even more complicated. To do this, we will use ufw to configure the system firewall and proftpd to manage our FTP server.
---

We will run a FTP server, behind a firewall using Docker. Cool, isn't it?

FTPs are already boring enough to set up when you're behind a firewall. But when
you try to set up a FTP with Docker, it's even more complicated. To do this, we
will use ufw to configure the system firewall and proftpd to manage our FTP
server.

## Installation of the container

Fortunately, there are already ready-made images just for us, namely
`cyberduck/proftpd-mysql` (https://hub.docker.com/r/cyberduck/proftpd-mysql/).
This image, quite simple, configures proftpd. It initializes the passive ports
(`60000-60100`) of the container, as well as the active ports (`20:21`). If you
start the container, you will obviously not be able to connect if `ufw` is
configured to deny all incoming ports. To do this, simply run the following
commands to configure `ufw` and forward the host ports to the container ports:

```bash
ufw allow 20/tcp
ufw allow 21/tcp
ufw allow 60000:60100/tcp
```

Magically, the active mode works, but not the passive mode. In fact, `proftpd`
needs to obtain an IP accessible from the Internet in order to be able to
communicate on passive ports. However, here, he only has access to his
container, not to the host. Fortunately, a configuration exists in the case of
proftpd, namely `MasqueradeAddress`
(http://proftpd.org/docs/directives/linked/config_ref_MasqueradeAddress.html).
This directive allows you to no longer use the IP of the container but that of
the host, by specifying a domain name or an IP. This directive is set by default
to `127.0.0.0.1` from the Dockerfile of the image, but this value does not suit
us. To do this, two options :

- or you connect directly to the container to inject the directive ;
- either you create an image, based on `cyberduck/proftpd-mysql` in order to add
  the directive to the build (or at launch, in order to be able to manage the
  value via an environment variable) ;

Personally, I prefer to create my own image by far, in order to be able to add
an environment variable and manage this variable. That's what we're going to do:

```dockerfile
# Dockerfile
FROM cyberduck/proftpd-mysql:latest
COPY entrypoint.sh /usr/local/sbin/override-entrypoint.sh
ENTRYPOINT ["/usr/local/sbin/override-entrypoint.sh"]
```

```bash
# entrypoint.sh (0775)
#!/bin/sh

if [ -n "$PROFTPD_PUBLICIP" ]; then
    sed -i.bak "s/^\(MasqueradeAddress\).*/MasqueradeAddress $PROFTPD_PUBLICIP/" /etc/proftpd/proftpd.conf
fi

# call original entrypoint script
/usr/local/sbin/entrypoint.sh "$@"
```

Now you can use the environment variables (here `PROFTPD_PUBLICIP`) to change
the public IP of your FTP server on a case-by-case basis.

## Server behind a failover IP

When using services such as FTP, it is preferable to use what is called a
failover IP, in order to be able to redirect traffic without waiting for DNS
propagation in case of a problem. However, once a failover IP is listened and
pointed to your system, the FTP active mode will no longer work because your
firewall will use `MASQUERADE` from port 20 using the server address, not the
failover one. This implies that during the active connection, the client
firewall will reject the connection request from port 20 of the server because
it a different one from port 21. So, you have to be able to solve this problem,
and here is one solution I chose: modify the firewall so that it executes a
`SNAT` rule just before the `MASQUERADE` set up by Docker.

To do this, you must modify the `before.rules` file of ufw
(`/etc/ufw/before.rules`) and add this before the `*filter` directive :

```bash
*nat
:PREROUTING ACCEPT [0:0]
-I POSTROUTING -p tcp --sport 20 -j SNAT --to $FAILOVERIP
COMMIT
```

... which amounts to doing it manually `iptables -t nat -I POSTROUTING -j
SNAT -p tcp --sport 20 --to $FAILOVERIP`. From there, you will no longer be able
to connect to the FTP server from the server address, but only from the failover
address (or aliases of the failover).
