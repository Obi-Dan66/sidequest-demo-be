import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { AppEventName } from './events.types';

type Listener = (payload: unknown) => void | Promise<void>;

/**
 * Lightweight in-process pub/sub.
 *
 * - Suitable for MVP: no extra dependencies, decouples gamification / notifications / WS gateways.
 * - Future evolution (documented in SKILL.md): swap implementation for BullMQ-backed events
 *   or a real broker (NATS / Redis Streams) without changing call sites.
 */
@Injectable()
export class EventsBus {
  private readonly emitter = new EventEmitter();
  private readonly logger = new Logger(EventsBus.name);

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  emit<T>(event: AppEventName, payload: T): void {
    this.logger.debug(`emit ${event}`);
    this.emitter.emit(event, payload);
  }

  on(event: AppEventName, listener: Listener): void {
    this.emitter.on(event, listener);
  }

  off(event: AppEventName, listener: Listener): void {
    this.emitter.off(event, listener);
  }
}
