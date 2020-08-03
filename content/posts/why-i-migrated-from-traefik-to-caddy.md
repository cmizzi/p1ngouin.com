---
title       : Why I migrated from Traefik to Caddy
description : The primary reasons why I migrated from Traefik to Caddy.
---

First, let's define what is [Traefik](https://traefik.io/). Traefik is a an
open-source reverse proxy and load balancer for HTTP and TCP-based applications.
It generates SSL certificates for you on the fly (based on a configuration
defined in a static file or dynamically using Docker networks and labels). The
main advantage of this solution is that it is turnkey. This application has been
specially designed to work with Docker in order to be able to detect the
presence of containers in the network, read labels and automatically redirect
traffic to the correct container (as a load balancer). After a few weeks of use
and many managed sites (+150), Traefik proved to be quite poor at managing HTTP
certificates. Indeed, thanks to the KV store solutions (such as Consul), Traefik
keeps the certificates in a single large JSON, gzipped under a single key. A big
disappointment for me.

> Consul allows you to store configurations/certificates between several
> servers, sharing the same Swarm cluster.

This problem, which may seem benign, is not. Indeed, with a very large number of
certificates, we very quickly encounter a problem related to Consul : [a limit
of 512KB is applied per
value](https://www.consul.io/docs/faq.html#q-what-is-the-per-key-value-size-limitation-for-consul-39-s-key-value-store-).
The only way to solve this problem was to compile a customized version of Consul
in order to significantly increase this limit (at the risk of losing
performance) by using the following patch :

```diff
--- kvs_endpoint.go	2018-11-23 16:09:26.771017520 +0100
+++ kvs_endpoint.go.t	2018-11-23 16:10:10.462064157 +0100
@@ -16,7 +16,7 @@
 	// maxKVSize is used to limit the maximum payload length
 	// of a KV entry. If it exceeds this amount, the client is
 	// likely abusing the KV store.
-	maxKVSize = 512 * 1024
+	maxKVSize = 5120 * 1024
 )

 func (s *HTTPServer) KVSEndpoint(resp http.ResponseWriter, req *http.Request) (interface{}, error) {
```

This problem having been solved, several months have passed without any
problems. Certificates were correctly generated, stored and served. After this
serenity, Traefik suddenly started to stop renewing certificates for some sites
(using HTTP-01). I looked for where this bug could have come from, and I came
across these different issues:

- https://github.com/containous/traefik/issues/3487
- https://github.com/containous/traefik/issues/5426

Using the HA part heavily, I cannot do without the Swarm currently in place, and
the certificates must continue to be renewed. To date, I have not found any
solution to avoid the synchronization error of the KV store (Consul, Etcd...).
Containous formally explains that the notion of HA will only be officially
supported on the commercial version of Traefik. As a result, I find myself in a
dead end. I trusted a solution that no longer meets my needs, which took several
days to implement.

## Looking for alternatives

After several hours of research and a little reddit, several solutions were
possible:

- [Caddy](https://caddyserver.com/) ;
- [Envoy](https://www.envoyproxy.io/) ;
- [Istio](https://istio.io/) ;
- ... and certainly others

However, the solution also had to meet several criteria:

- Easily configurable ;
- Discover the services in the Swarm ;
- Automatic generation of SSL certificates ;
- Implementation of mesh routing (optional) ;

The last two solutions seemed very complex to configure. Caddy only partially
meets these criteria. Indeed, it was not developed with a use under Docker. He
didn't seem like a good candidate to me. Then, after seeing this solution come
up, I asked myself a few questions : why do you hear so much about Caddy ? Now I
know.

## Caddy to the rescue !

Caddy was designed to work (written in Go) with modules, so it is fully
extensible. First, [Caddy can work, since version 0.11, with Consul with a
plugin](https://github.com/pteich/caddy-tlsconsul) to store the different HTTP
certificates generated. This is already a very good point in order to be able to
share certificates between several servers. Second, Caddy also has [a plugin to
listen to the Swarm](https://github.com/lucaslorentz/caddy-docker-proxy) to
automatically generate a configuration file in memory based on existing
services/containers. And finally, Caddy's configuration is extremely simple and
it manages DNS/HTTP-01 resolvers in parallel (instead of Traefik).

In order to consolidate Caddy and its plugins, I decided to generate a custom
Docker image, actually containing only one file (excluding the CI part):

```go
main package

import (
	"github.com/caddyserver/caddy/caddy/caddy/caddymain"

	// List of plugins
	_ "github.com/lucaslorentz/caddy-docker-proxy/plugin"
	_ "github.com/pteich/caddy-tlsconsul"
)

func main() {
	caddymain.Run()
}
```

## Time for migration

To begin with, I migrated only one server under Caddy (the one containing the
most sites, obviously to test the resilience of the solution).

```yaml
version: "3.4"
services:
	custom-service:
		image: containous/whoami
		networks:
			- routable
		deploy:
			labels:
				traefik.port: 80
				traefik.docker.network: routable
				traefik.frontend.rule: "Host:example.com"
				traefik.frontend.entryPoints: http,https

networks:
	routable:
		external: true
```

Now, using Caddy's labels.

```yaml
version: "3.4"
services:
	custom-service:
		image: containous/whoami
		networks:
			- routable
		deploy:
			labels:
				caddy.address: https://example.com
				caddy.targetport: "80"

networks:
	routable:
		external: true
```

Nothing extraordinary here, except that Caddy works, renews all certificates
correctly and is fully customizable. In addition, the icing on the cake: the TLS
Consul plugin used with Caddy registers one SSL certificate per entry, awesome.

## The routing mesh (optional)

The technique is the same between Traefik and Caddy here. The purpose of mesh
routing is to point any IP to any server in the Swarm and get the response from
the right container. Personally, I'm not a fan of the principle of assigning IPs
only to `manager` nodes. So here's the technique I use :

```yaml
version  : "3.4"
services :
    consul:
        image    : consul:latest
        command  : agent -server -bootstrap-expect=1
        networks :
            - consul
        volumes  :
            - "consul-data:/consul/data"
        deploy   :
            mode: replicated
            replicas: 1
        environment :
            - CONSUL_LOCAL_CONFIG={"datacenter":"us_east2","server":true}
            - CONSUL_BIND_INTERFACE=eth0
            - CONSUL_CLIENT_INTERFACE=eth0

    docker-proxy:
        image: rancher/socat-docker
        networks:
            - caddy
        volumes:
            - /var/run/docker.sock:/var/run/docker.sock
        deploy:
            mode: replicated
            replicas: 1

    caddy:
        image    : <custom-caddy-image>
        command  : -email <redacted> -agree=true -log stdout -proxy-service-tasks=true -docker-validate-network=false
        networks :
            - routable
            - caddy
            - consul
        ports    :
            - target    : 80
              published : 80
              mode      : host
            - target    : 443
              published : 443
              mode      : host
        deploy:
            mode          : global
            update_config :
                parallelism : 10
                delay       : 10s
            restart_policy :
                condition : on-failure
        environment :
            DOCKER_HOST: tcp://docker-proxy:2375
            CONSUL_HTTP_ADDR: consul:8500

volumes :
    consul-data:

networks:
    routable:
        external: true

    consul:
        driver: overlay

    caddy:
        driver: overlay
```

With this configuration, it is no longer a question of running Caddy only on the
`manager` nodes, but on all the nodes available in the Swarm. Since certificates
are generated by only one instance of the application, we have no problem
running multiple caddy instances. IPs can now be pointed to any server in the
Swarm, and Caddy will forward the request to the right container (even if it is
not on the same server).

Now I have a Traefik version of Caddy and it fits all my needs.
