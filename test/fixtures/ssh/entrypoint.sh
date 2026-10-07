#!/bin/sh
set -eu
cp /etc/ssh/sshd_config.base /etc/ssh/sshd_config
case "${FIXTURE_MODE:-}" in
  sftp) printf '\nSubsystem sftp internal-sftp -d /data\n' >> /etc/ssh/sshd_config ;;
  sftp-only) printf '\nSubsystem sftp internal-sftp -d /data\nForceCommand internal-sftp -d /data\n' >> /etc/ssh/sshd_config ;;
  auth)
    cp /etc/ssh/sshd_config.auth /etc/ssh/sshd_config
    chpasswd -e < /fixtures/password_hash
    ;;
  scp) ;; # No Subsystem sftp: modern scp's SFTP mode must fail.
  *) echo 'Unknown fixture mode' >&2; exit 1 ;;
esac
install -m 600 /fixtures/host_ed25519 /etc/ssh/ssh_host_ed25519_key
install -m 644 /fixtures/host_ed25519.pub /etc/ssh/ssh_host_ed25519_key.pub
chown fixture:fixture /home/fixture/.ssh
install -o fixture -g fixture -m 600 /fixtures/authorized_keys /home/fixture/.ssh/authorized_keys
printf 'xScp isolated %s fixture\n' "$FIXTURE_MODE" > /data/server-marker.txt
chown fixture:fixture /data/server-marker.txt
/usr/sbin/sshd -t
exec /usr/sbin/sshd -D -e
