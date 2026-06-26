# Deployment on GCP (e2-micro + nginx + HTTPS) — akash.2haas.com

Goal: judges can reach `https://akash.2haas.com/health` and
`https://akash.2haas.com/analyze-ticket` with **no** assistance. One command does
everything: `sudo python3 deploy/run_onVM.py`.

> Works on **any** Debian/Ubuntu VM — GCP e2-micro, **DigitalOcean** droplet
> (this deployment: `139.59.68.202`), AWS, etc. The `gcloud` commands below are
> GCP-specific; on DigitalOcean just create an Ubuntu droplet and skip to §2.

---

## 0. What the script does (recap)

`deploy/run_onVM.py` is idempotent and, on a fresh Debian/Ubuntu VM:
1. installs nginx, certbot, docker, curl;
2. adds **2 GB swap** (1 GB micro VMs need it for the frontend build);
3. writes `/opt/queuestorm/.env` from your keys (or deterministic mode);
4. provisions a tuned **MySQL** container (durability mirror; `--no-db` to skip);
5. builds + runs the **backend** container on `127.0.0.1:8787`;
6. builds the **frontend** and serves it from `/var/www/queuestorm`;
7. configures **nginx** to route `/health`, `/analyze-ticket`, `/api/*`;
8. runs **certbot** for Let's Encrypt HTTPS (best effort);
9. verifies `/health`.

MySQL runs on a private Docker network (not published to the host/internet) and
is **never** in the request path — if it fails, the API keeps serving.

---

## 1. Create the VM (one time)

```bash
gcloud compute instances create queuestorm \
  --machine-type=e2-micro \
  --image-family=debian-12 --image-project=debian-cloud \
  --tags=http-server,https-server \
  --zone=asia-southeast1-a
```

Open ports 80/443:

```bash
gcloud compute firewall-rules create allow-web \
  --allow tcp:80,tcp:443 --target-tags=http-server,https-server
```

Note the VM's **external IP** (`gcloud compute instances describe queuestorm
--format='get(networkInterfaces[0].accessConfigs[0].natIP)'`).

---

## 2. Point DNS

In the DNS for `2haas.com`, add an **A record**:

```
akash.2haas.com    A    139.59.68.202    (TTL 300)
```

Wait until `nslookup akash.2haas.com` returns the VM IP before requesting TLS.

---

## 3. Get the code + keys onto the VM

```bash
# SSH in
gcloud compute ssh queuestorm --zone=asia-southeast1-a

# Clone your repo
git clone https://github.com/MdAhbab/akash.git
cd akash
```

The real keys are **not** in git (by design). Put them on the VM one of three ways:

```bash
# (a) create the env file directly (recommended)
nano .env        # paste the contents of your local .env (GEMINI_API_KEY, etc.)

# (b) or scp it from your laptop:
#     gcloud compute scp .env queuestorm:~/akash/.env --zone=asia-southeast1-a

# (c) or skip keys entirely → deterministic mode (still fully judgeable)
```

---

## 4. Deploy (one command)

```bash
sudo python3 deploy/run_onVM.py
# variants:
#   sudo python3 deploy/run_onVM.py --skip-tls        # DNS not ready yet
#   sudo DOMAIN=akash.2haas.com EMAIL=ahbab.md@gmail.com python3 deploy/run_onVM.py
#   sudo python3 deploy/run_onVM.py --no-frontend     # API only (smallest footprint)
```

When it finishes it prints the live URLs. Re-run any time to update (it rebuilds
containers and reloads nginx without downtime to the static site).

---

## 5. Verify from your laptop

```bash
curl https://akash.2haas.com/health
curl -X POST https://akash.2haas.com/analyze-ticket \
  -H "Content-Type: application/json" \
  -d '{"ticket_id":"TKT-001","complaint":"I sent 5000 taka to a wrong number","transaction_history":[{"transaction_id":"TXN-9101","type":"transfer","amount":5000,"counterparty":"+8801719876543","status":"completed"}]}'
```

---

## 6. Operations

```bash
docker ps                              # containers (queuestorm-api, queuestorm-db)
docker logs -f queuestorm-api          # API logs
docker restart queuestorm-api          # restart API
docker exec -it queuestorm-db mysql -uqueuestorm -p queuestorm   # inspect DB
sudo systemctl reload nginx            # reload web
sudo certbot renew --dry-run           # TLS renewal (auto-scheduled by certbot)
```

The backend container has `--restart unless-stopped`, so it survives reboots.
certbot installs a renewal timer automatically.

---

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| `/health` works locally but not from outside | Check the GCP firewall allows 80/443 and the VM has the `http-server`/`https-server` tags. |
| certbot fails | DNS not propagated yet. Re-run after `nslookup` shows the VM IP; HTTP stays live meanwhile. |
| Frontend build killed (OOM) | Confirm swap is on: `swapon --show`. The script adds it; reboot if it didn't take. |
| API 502 in nginx | `docker logs queuestorm-api`; ensure it's listening on `127.0.0.1:8787`. |
| Need to rotate keys | Edit `/opt/queuestorm/.env`, then `docker restart queuestorm-api`. |

---

## Alternative: all-in-one Docker Compose

If you prefer containers only (no host nginx):

```bash
cd deploy
docker compose --env-file ../.env up -d --build
# SPA at http://<host>/  ·  API at http://<host>/health
```

For HTTPS in that mode, front it with a TLS-terminating proxy (Caddy/Cloudflare)
or add a certbot sidecar.
