-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "privyId" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "role" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentKey" (
    "id" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AgentKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "shortId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "scopeMd" TEXT NOT NULL,
    "scopeHash" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "commit" TEXT,
    "payer" TEXT,
    "payerUserId" TEXT,
    "worker" TEXT,
    "workerHint" TEXT,
    "workerUserId" TEXT,
    "autoRelease" INTEGER NOT NULL,
    "minConfidenceBps" INTEGER NOT NULL,
    "maxAutoAmount" TEXT NOT NULL,
    "reviewWindow" INTEGER NOT NULL,
    "submitDeadline" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "verdict" TEXT,
    "confidenceBps" INTEGER,
    "resubmits" INTEGER NOT NULL DEFAULT 0,
    "fundedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "attestedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "paymentDeadlineAt" TIMESTAMP(3),
    "deliverableHash" TEXT,
    "attestationHash" TEXT,
    "txs" JSONB NOT NULL DEFAULT '{}',
    "feeBps" INTEGER NOT NULL DEFAULT 100,
    "amountPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobSecret" (
    "jobId" TEXT NOT NULL,
    "amountEnc" TEXT NOT NULL,
    "saltEnc" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobSecret_pkey" PRIMARY KEY ("jobId")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "manifestHash" TEXT NOT NULL,
    "submittedBy" TEXT NOT NULL,
    "resubmission" INTEGER NOT NULL DEFAULT 0,
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verdict" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'queued',
    "verdict" TEXT,
    "confidenceBps" INTEGER,
    "report" JSONB,
    "reportHash" TEXT,
    "reportKey" TEXT,
    "model" TEXT,
    "promptHash" TEXT,
    "responseHash" TEXT,
    "attestTx" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verdict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "by" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reasonHash" TEXT NOT NULL,
    "txHash" TEXT,
    "workerBps" INTEGER,
    "note" TEXT,
    "resolveTx" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attribution" (
    "ref" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "memo" TEXT,
    "jobId" TEXT,
    "sourceTx" TEXT,
    "txHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attribution_pkey" PRIMARY KEY ("ref")
);

-- CreateTable
CREATE TABLE "ChainEvent" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "jobId" TEXT,
    "args" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndexerCursor" (
    "chainId" INTEGER NOT NULL,
    "lastBlock" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndexerCursor_pkey" PRIMARY KEY ("chainId")
);

-- CreateTable
CREATE TABLE "TxLog" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "jobId" TEXT,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "hash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "gasUsed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TxLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FunnelEvent" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunnelEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_privyId_key" ON "User"("privyId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_address_key" ON "User"("address");

-- CreateIndex
CREATE UNIQUE INDEX "AgentKey_keyHash_key" ON "AgentKey"("keyHash");

-- CreateIndex
CREATE INDEX "AgentKey_address_idx" ON "AgentKey"("address");

-- CreateIndex
CREATE UNIQUE INDEX "Job_shortId_key" ON "Job"("shortId");

-- CreateIndex
CREATE INDEX "Job_payer_idx" ON "Job"("payer");

-- CreateIndex
CREATE INDEX "Job_worker_idx" ON "Job"("worker");

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");

-- CreateIndex
CREATE INDEX "Job_chainId_status_idx" ON "Job"("chainId", "status");

-- CreateIndex
CREATE INDEX "Delivery_jobId_idx" ON "Delivery"("jobId");

-- CreateIndex
CREATE INDEX "Verdict_jobId_idx" ON "Verdict"("jobId");

-- CreateIndex
CREATE INDEX "Verdict_stage_idx" ON "Verdict"("stage");

-- CreateIndex
CREATE INDEX "Dispute_jobId_idx" ON "Dispute"("jobId");

-- CreateIndex
CREATE INDEX "Attribution_jobId_idx" ON "Attribution"("jobId");

-- CreateIndex
CREATE INDEX "ChainEvent_jobId_idx" ON "ChainEvent"("jobId");

-- CreateIndex
CREATE INDEX "ChainEvent_chainId_blockNumber_idx" ON "ChainEvent"("chainId", "blockNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ChainEvent_chainId_txHash_logIndex_key" ON "ChainEvent"("chainId", "txHash", "logIndex");

-- CreateIndex
CREATE INDEX "TxLog_jobId_idx" ON "TxLog"("jobId");

-- CreateIndex
CREATE INDEX "TxLog_status_idx" ON "TxLog"("status");

-- CreateIndex
CREATE INDEX "FunnelEvent_kind_idx" ON "FunnelEvent"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_jobId_to_kind_key" ON "Notification"("jobId", "to", "kind");

-- AddForeignKey
ALTER TABLE "AgentKey" ADD CONSTRAINT "AgentKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_payerUserId_fkey" FOREIGN KEY ("payerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_workerUserId_fkey" FOREIGN KEY ("workerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSecret" ADD CONSTRAINT "JobSecret_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verdict" ADD CONSTRAINT "Verdict_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verdict" ADD CONSTRAINT "Verdict_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attribution" ADD CONSTRAINT "Attribution_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChainEvent" ADD CONSTRAINT "ChainEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TxLog" ADD CONSTRAINT "TxLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelEvent" ADD CONSTRAINT "FunnelEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

