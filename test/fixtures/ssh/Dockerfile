# Multi-platform official Debian image; digest fixes the base image.
FROM debian:bookworm-slim@sha256:7c7b2c966bc9ee8cedfeef67e0e279108992c77681fa595db4a9d65c06ccc587
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssh-server openssh-client coreutils findutils ca-certificates curl \
 && rm -rf /var/lib/apt/lists/* /etc/ssh/ssh_host_* \
 && useradd --create-home --shell /bin/sh fixture \
 && passwd -d fixture \
 && mkdir -p /run/sshd /data /home/fixture/.ssh \
 && chown fixture:fixture /data \
 && chmod 700 /home/fixture/.ssh
COPY sshd_config /etc/ssh/sshd_config.base
COPY entrypoint.sh /usr/local/bin/fixture-entrypoint
RUN chmod 755 /usr/local/bin/fixture-entrypoint
EXPOSE 22
ENTRYPOINT ["/usr/local/bin/fixture-entrypoint"]
