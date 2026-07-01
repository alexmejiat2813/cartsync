import { PrismaClient, ListStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('seed_password_123', 12);

  const user = await prisma.user.upsert({
    where: { email: 'seed@cartsync.dev' },
    update: {},
    create: {
      email: 'seed@cartsync.dev',
      passwordHash,
      name: 'Seed User',
    },
  });

  console.log(`User: ${user.email} (${user.id})`);

  const [walmart, heb, chedraui] = await Promise.all([
    prisma.supermarket.create({
      data: { userId: user.id, name: 'Walmart Insurgentes', address: 'Av. Insurgentes Sur 1234, CDMX' },
    }),
    prisma.supermarket.create({
      data: { userId: user.id, name: 'HEB Monterrey', address: 'Av. Constitución 123, MTY' },
    }),
    prisma.supermarket.create({
      data: { userId: user.id, name: 'Chedraui Perisur', address: 'Periferico Sur 4690, CDMX' },
    }),
  ]);

  console.log(`Supermarkets: ${[walmart, heb, chedraui].map((s) => s.name).join(', ')}`);

  const activeList = await prisma.shoppingList.create({
    data: {
      userId: user.id,
      supermarketId: walmart.id,
      name: 'Compras semana 27',
      status: ListStatus.ACTIVE,
      currency: 'MXN',
      products: {
        create: [
          { name: 'Leche Lala entera 1L', quantity: 2, unitPrice: 28.5, brand: 'Lala', barcode: '7501055300166' },
          { name: 'Pan Bimbo blanco', quantity: 1, unitPrice: 42.0, brand: 'Bimbo', barcode: '7441029502305' },
          { name: 'Arroz SOS 1kg', quantity: 3, unitPrice: 35.0, brand: 'SOS' },
        ],
      },
    },
  });

  const completedList = await prisma.shoppingList.create({
    data: {
      userId: user.id,
      supermarketId: heb.id,
      name: 'Frutas y verduras semana 26',
      status: ListStatus.COMPLETED,
      currency: 'MXN',
      totalAmount: 187.5,
      purchasedAt: new Date('2026-06-23T18:00:00Z'),
      products: {
        create: [
          { name: 'Manzanas Gala 1kg', quantity: 2, unitPrice: 45.0, checked: true },
          { name: 'Jitomate bola 500g', quantity: 1, unitPrice: 32.5, checked: true },
          { name: 'Aguacate Hass x3', quantity: 1, unitPrice: 65.0, checked: true },
        ],
      },
    },
  });

  console.log(`Lists: "${activeList.name}" (ACTIVE), "${completedList.name}" (COMPLETED)`);
  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
