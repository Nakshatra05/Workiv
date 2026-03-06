# Workiv

Workiv is a decentralized job board platform built on Arkiv, enabling users to post jobs, find opportunities, and build professional profiles in a censorship-resistant environment. Employers can post job listings with company logos and descriptions, job seekers can browse opportunities, manage professional profiles, and apply to positions, all powered by Arkiv.

### Architecture and user flow
- https://app.eraser.io/workspace/KqNZhASWumte7R09hhSh?origin=share


## What it does?

### Core Functionality

- **Job Listings**: Employers can create job posts with company logos, descriptions, and requirements stored securely on the blockchain
- **Job Board**: Dynamic job feed that displays opportunities from various companies and trending positions
- **Featured Jobs**: Highlighted opportunities with automatic expiration for time-sensitive hiring

## Project Setup and Initialization

### Prerequisites


### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/your-username/workiv.git
   cd workiv
   ```

2. **Install dependencies:**

   ```bash
   npm install
   # or
   yarn install
   ```

3. **Environment Configuration:**

   Copy the example environment file and configure your variables:

   ```bash
   cp .env.example .env.local 
   ```

   Configure the following environment variables in your `.env` file:

   ```env
   ARKIV_PRIVATE_KEY=your_arkiv_private_key_here
   ```

   **Note:** You'll need to obtain an Arkiv Network private key to interact with the blockchain. Contact the Arkiv team or check their documentation for setup instructions.

### Development

4. **Start the development server:**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

   The application will be available at [http://localhost:3000](http://localhost:3000)

### Building for Production

1. **Build the application:**

   ```bash
   npm run build
   # or
   yarn build
   ```

2. **Start the production server:**

   ```bash
   npm start
   # or
   yarn start
   ```

### Arkiv Features by Module

Based on codebase analysis, here's how **Workiv features leverage Arkiv capabilities**:

#### **CRUD Operations + Advanced Querying**

- **Job Listings**: Create entities with company logo, metadata, and job data; query by type and attributes
- **Job Board**: Complex queries with pagination, filtering by job type and timestamps
- **Featured Jobs**: Entity creation with rich attributes, querying by featured type and expiration
- **Profiles**: Professional profile creation and querying with attribute-based filtering

#### **TTL-Aware User Experience**

- **Featured Jobs**: Configurable TTL (1 minute, 5 minutes, 24 hours) for time-sensitive opportunities
- **Job Listings**: 30-day TTL for job postings with automatic expiration
- **Media**: TTL-based cleanup of images and metadata at blockchain level

#### **Real-Time Subscriptions**

- **Live Feed**: Server-Sent Events for real-time post updates (currently polling-based)
- **Feed Streaming**: Event-driven content delivery without page refreshes

#### **Advanced JSON-RPC Integration**

- **Wallet Connection**: MetaMask integration for blockchain authentication
- **Transaction Handling**: Multi-entity creation with receipt confirmation
- **Content Ownership**: Cryptographic verification of user-generated content

## Arkiv Network Modules Used

Workiv leverages the following **@arkiv-network/sdk** modules (v0.4.4):

### Core SDK Modules

- **`@arkiv-network/sdk`** - Core client creation (`createWalletClient`, `createPublicClient`, `http`)
- **`@arkiv-network/sdk/accounts`** - Account management (`privateKeyToAccount`)
- **`@arkiv-network/sdk/chains`** - Network configuration (`mendoza` testnet)

### Query & Data Modules

- **`@arkiv-network/sdk/query`** - Query building (`eq` for equality operations)
- **`@arkiv-network/sdk/utils`** - Utilities (`ExpirationTime`, `jsonToPayload`)
- **`@arkiv-network/sdk/types`** - TypeScript types (`Entity`)
