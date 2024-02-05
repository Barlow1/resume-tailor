import { PrismaClient } from "@prisma/client";

export const createSubscription = async ({
  userId,
  stripeCustomerId,
  name,
  stripePriceId,
  stripeProductId,
}: {
  userId: string;
  stripeCustomerId: string;
  name: string;
  stripePriceId: string;
  stripeProductId: string;
}) => {
  const prisma = new PrismaClient();
  try {
    prisma.$connect();

    const subscription = await prisma.subscription.create({
      data: {
        ownerId: userId,
        stripeCustomerId,
        name,
        stripePriceId,
        stripeProductId,
        active: false,
      },
    });

    return subscription;
  } catch (e) {
    console.error("Error updating customer stripe id", e);
    throw e;
  } finally {
    prisma.$disconnect();
  }
};

export const getActiveSubscriptions = async (userId: string) => {
  const prisma = new PrismaClient();
  try {
    prisma.$connect();

    const subscriptions = await prisma.subscription.findMany({
      where: {
        ownerId: userId,
        active: true,
      },
    });

    return subscriptions;
  } catch (e) {
    console.error("Error updating customer stripe id", e);
    throw e;
  } finally {
    prisma.$disconnect();
  }
};

export const activateSubscription = async (
  subscriptionId: string,
  stripeSubscriptionId: string
) => {
  const prisma = new PrismaClient();
  try {
    prisma.$connect();

    const subscriptions = await prisma.subscription.update({
      where: {
        id: subscriptionId,
      },
      data: {
        active: true,
        stripeSubscriptionId,
      },
    });

    return subscriptions;
  } catch (e) {
    console.error("Error updating customer stripe id", e);
    throw e;
  } finally {
    prisma.$disconnect();
  }
};

export const deactivateSubscription = async (subscriptionId: string) => {
  const prisma = new PrismaClient();
  try {
    prisma.$connect();

    const subscriptions = await prisma.subscription.update({
      where: {
        stripeSubscriptionId: subscriptionId
      },
      data: {
        active: false,
      },
    });

    return subscriptions;
  } catch (e) {
    console.error("Error updating customer stripe id", e);
    throw e;
  } finally {
    prisma.$disconnect();
  }
};
