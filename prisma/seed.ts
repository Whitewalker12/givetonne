import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const projects = [
  {
    id: "kasigau",
    name: "Kasigau Corridor REDD+",
    location: "Kenya",
    type: "Forest protection",
    registry: "Verra VCS",
    registryId: "VCS-612",
    vintage: 2022,
    pricePerTonne: 1800,
    description:
      "Protects 200,000 hectares of dryland forest between Tsavo East and West, a wildlife corridor for elephants and lions, while funding local schools and jobs.",
    imageEmoji: "🐘",
    availableTonnes: 1200,
  },
  {
    id: "cookstoves-gh",
    name: "Efficient Cookstoves",
    location: "Ghana",
    type: "Clean cookstoves",
    registry: "Gold Standard",
    registryId: "GS-4421",
    vintage: 2023,
    pricePerTonne: 1400,
    description:
      "Distributes fuel-efficient stoves to rural households, cutting wood use by half and reducing indoor smoke that harms women and children.",
    imageEmoji: "🔥",
    availableTonnes: 800,
  },
  {
    id: "mangroves-id",
    name: "Mangrove Restoration",
    location: "Indonesia",
    type: "Blue carbon",
    registry: "Verra VCS",
    registryId: "VCS-2418",
    vintage: 2023,
    pricePerTonne: 2600,
    description:
      "Replants coastal mangroves that store up to four times more carbon than rainforest and shield villages from storm surges.",
    imageEmoji: "🌊",
    availableTonnes: 450,
  },
  {
    id: "wind-in",
    name: "Community Wind Farm",
    location: "Tamil Nadu, India",
    type: "Renewable energy",
    registry: "Verra VCS",
    registryId: "VCS-1090",
    vintage: 2021,
    pricePerTonne: 900,
    description:
      "Grid-connected wind turbines displacing coal power, with revenue shared with surrounding villages.",
    imageEmoji: "💨",
    availableTonnes: 3000,
  },
];

async function main() {
  for (const p of projects) {
    // Never reset inventory on re-seed.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { availableTonnes, ...details } = p;
    await prisma.project.upsert({ where: { id: p.id }, update: details, create: p });
  }
  console.log(`Seeded ${projects.length} projects`);
}

main().finally(() => prisma.$disconnect());
