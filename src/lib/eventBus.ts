import { EventEmitter } from "node:events";
import { logger } from "@/lib/logger.js";

/**
 * Domain event bus — the seam that keeps this a modular MONOLITH instead of
 * a big ball of mud, and the seam that makes it microservice-ready without
 * doing the split now.
 *
 * Modules must not import each other's repositories. When module A needs to
 * react to something in module B (e.g. "orders" decrementing stock after
 * "checkout" places an order), B publishes a DomainEvent and A subscribes —
 * it never calls into B's internals directly.
 *
 * Today this is an in-memory EventEmitter, so it's zero extra infra for a
 * single-process deploy. The day these modules split into real services,
 * only THIS FILE changes (swap the emitter for a RabbitMQ/Kafka/SNS+SQS
 * client) — every publish()/subscribe() call site is untouched because they
 * only depend on the IEventBus shape below, not on Node's EventEmitter.
 */

export interface DomainEvent<T = unknown> {
  type: string;
  payload: T;
  occurredAt: string;
}

export interface IEventBus {
  publish<T>(type: string, payload: T): void;
  subscribe<T>(type: string, handler: (payload: T) => void | Promise<void>): void;
}

class InMemoryEventBus implements IEventBus {
  private emitter = new EventEmitter();

  publish<T>(type: string, payload: T): void {
    const event: DomainEvent<T> = { type, payload, occurredAt: new Date().toISOString() };
    logger.debug({ event }, "domain event published");
    this.emitter.emit(type, event);
  }

  subscribe<T>(type: string, handler: (payload: T) => void | Promise<void>): void {
    this.emitter.on(type, async (event: DomainEvent<T>) => {
      try {
        await handler(event.payload);
      } catch (err) {
        logger.error({ err, eventType: type }, "domain event handler failed");
      }
    });
  }
}

export const eventBus: IEventBus = new InMemoryEventBus();

// Central registry of event names so producers/consumers can't typo a topic.
export const DomainEvents = {
  OrderPlaced: "order.placed",
  RetailerApproved: "retailer.approved",
  RetailerRejected: "retailer.rejected",
  RetailerRegistered: "retailer.registered",
  ProductCreated: "product.created",
  EventVoteCast: "event.vote_cast",
  UserRegistered: "user.registered",
} as const;
