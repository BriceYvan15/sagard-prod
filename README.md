# SAGARD SÉCURITÉ — ERP Production

Système de gestion intégré pour SAGARD SÉCURITÉ (agence de sécurité privée en Côte d'Ivoire).

## Architecture

```
sagard-prod/
├── apps/
│   ├── api/        ← NestJS 10 (REST + WebSockets)
│   ├── web/        ← Next.js 14 App Router (admin/DG/RH)
│   └── mobile/     ← React Native + Expo (agents/contrôleurs)
├── packages/
│   └── database/   ← Prisma schema + migrations + seed
└── docker/         ← PostgreSQL 16, Redis 7, MinIO, Nginx
```

## Prérequis

- **Node.js** ≥ 20.0.0
- **pnpm** ≥ 9.0.0 : `npm install -g pnpm`
- **Docker Desktop** installé et démarré

---

## 🚀 Installation rapide (développement)

### 1. Cloner et installer les dépendances

```bash
cd c:\Users\HP\Downloads\sagard-prod
pnpm install
```

### 2. Configurer les variables d'environnement

```bash
# Copier et éditer le fichier .env de l'API
copy apps\api\.env.example apps\api\.env
```

Valeurs minimales déjà prêtes dans `.env.example` pour le dev local.

### 3. Démarrer l'infrastructure Docker (PostgreSQL + Redis + MinIO)

```bash
pnpm docker:up
```

Vérifier que les conteneurs tournent :
```bash
docker ps
```

### 4. Générer le client Prisma

```bash
cd packages\database
pnpm db:generate
```

### 5. Exécuter les migrations

```bash
pnpm db:migrate
```

### 6. Peupler la base de données (seed)

```bash
pnpm db:seed
```

### 7. Démarrer les applications

```bash
# Depuis la racine (tous les apps en parallèle)
pnpm dev

# Ou individuellement :
cd apps/api && pnpm dev    # API → http://localhost:4000
cd apps/web && pnpm dev    # Web → http://localhost:3000
```

---

## 🔑 Comptes par défaut (après seed)

| Rôle                | Email                     | Mot de passe  |
|---------------------|---------------------------|---------------|   |
| Commercial          | commercial@sagard.ci      | sagard2024!   |
| Comptable           | comptable@sagard.ci       | sagard2024!   |
| RH                  | rh@sagard.ci              | sagard2024!   |
| Chef Opérations     | ops@sagard.ci             | sagard2024!   |
| Contrôleur          | controleur@sagard.ci      | sagard2024!   |
| Agent terrain       | agent1@sagard.ci          | sagard2024!   |
| Client              | client@sonatel.ci         | sagard2024!   |

---

## 📖 Documentation API

Swagger disponible sur : `http://localhost:4000/api/docs`

---

## 🐳 Infrastructure Docker

| Service    | Port   | URL                        |
|------------|--------|----------------------------|
| PostgreSQL | 5432   | localhost:5432             |
| Redis      | 6379   | localhost:6379             |
| MinIO      | 9000   | http://localhost:9000      |
| MinIO UI   | 9001   | http://localhost:9001      |
| API        | 4000   | http://localhost:4000/api  |
| Web        | 3000   | http://localhost:3000      |

### Commandes utiles

```bash
pnpm docker:up      # Démarrer tous les services
pnpm docker:down    # Arrêter
pnpm docker:logs    # Voir les logs en temps réel
```

---

## ⚙️ Variables d'environnement importantes

### `apps/api/.env`

```env
DATABASE_URL=postgresql://sagard:sagard_secure_2024@localhost:5432/sagard_db
REDIS_URL=redis://:sagard_redis_2024@localhost:6379
JWT_SECRET=change_this_in_production
WHATSAPP_PHONE_NUMBER_ID=your_id     # Meta Cloud API
WHATSAPP_ACCESS_TOKEN=your_token
OPENAI_API_KEY=your_key
```

### `apps/web/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

---

## 🏗️ Modules implémentés

| Module         | Fonctionnalités                                                   |
|----------------|-------------------------------------------------------------------|
| **Auth**       | JWT, RBAC 10 rôles, sessions, changement mot de passe            |
| **CRM**        | Clients, contrats, historique, réclamations WhatsApp             |
| **Facturation**| Factures, devis, proforma, paiements, QR codes                   |
| **Opérations** | Pointage + photo obligatoire + GPS, rondes contrôleurs           |
| **RH**         | Agents, paie mensuelle, congés, formations, disciplinaire        |
| **Stock**      | Équipements (notif WhatsApp), véhicules, carburant, maintenance  |
| **GPS Temps réel** | WebSocket, tracking contrôleurs, temps/site, agents vérifiés |
| **Notifications**| In-app + WhatsApp (Meta Cloud API)                             |
| **IA**         | Assistant OpenAI GPT-4o                                          |
| **Stockage**   | MinIO (photos pointage, documents, équipements)                  |

---

## 📱 Application mobile (React Native + Expo)

```bash
cd apps/mobile
pnpm install
pnpm expo start
```

Fonctionnalités clés :
- **Photo obligatoire** via caméra (pas galerie) — Expo Camera
- **Géolocalisation** temps réel contrôleurs — Expo Location + WebSocket
- **Pointage** check-in/check-out avec photo + GPS
- **Notifications push** — Expo Notifications

---

## 🔒 Sécurité production

- [ ] Changer tous les mots de passe dans `.env`
- [ ] Configurer SSL/TLS dans Nginx
- [ ] Activer les backups PostgreSQL
- [ ] Configurer le domaine dans `ALLOWED_ORIGINS`
- [ ] Activer la rotation des logs
