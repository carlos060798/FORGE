/**
 * event-bus.ts — Bus de eventos en proceso para desacoplar módulos FORGE
 *
 * Todos los módulos (Orchestrator, AgentMemory, ASTIndexer, SessionBudget)
 * emiten y consumen eventos sin importarse directamente.
 *
 * Cuando se necesite multi-proceso, reemplazar EventBus con una implementación
 * Redis que exponga la misma API — el resto del código no cambia.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler<T = any> = (payload: T) => void | Promise<void>;

export class EventBus {
  private readonly handlers = new Map<string, Handler[]>();

  on<T>(event: string, handler: Handler<T>): void {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event)!.push(handler as Handler);
  }

  off<T>(event: string, handler: Handler<T>): void {
    const hs = this.handlers.get(event);
    if (!hs) return;
    const idx = hs.indexOf(handler as Handler);
    if (idx >= 0) hs.splice(idx, 1);
  }

  async emit<T>(event: string, payload: T): Promise<void> {
    const hs = this.handlers.get(event) ?? [];
    await Promise.all(hs.map(h => h(payload)));
  }

  /** Registra un handler que se dispara una sola vez y luego se elimina. */
  once<T>(event: string, handler: Handler<T>): void {
    const wrapper: Handler<T> = async (payload) => {
      this.off(event, wrapper);
      await handler(payload);
    };
    this.on(event, wrapper);
  }

  /** Elimina todos los handlers de un evento (útil en tests). */
  clear(event?: string): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }

  listenerCount(event: string): number {
    return this.handlers.get(event)?.length ?? 0;
  }
}

/** Singleton de proceso — importar desde cualquier módulo FORGE. */
export const bus = new EventBus();

/**
 * Eventos estándar emitidos por el engine FORGE.
 * Documentados aquí para que los módulos los consuman de forma tipada.
 *
 * Uso:
 *   bus.on('agent:result', ({ agente, tokens_input, tokens_output }) => { ... });
 *   bus.emit('file:written', { path: '/ruta/archivo.ts', agente: 'desarrollador-backend' });
 */
export interface ForgeEvents {
  'agent:result': {
    agente: string;
    taskId: string;
    tokens_input: number;
    tokens_output: number;
    modelo: string;
    durationMs: number;
    ok: boolean;
  };
  'file:written': {
    path: string;
    agente: string;
  };
  'task:completed': {
    taskId: string;
    agente: string;
    durationMs: number;
  };
  'task:failed': {
    taskId: string;
    agente: string;
    error: string;
  };
  'budget:warning': {
    tokens_acumulados: number;
    costo_usd: number;
    umbral_usd: number;
  };
  'pipeline:step': {
    step: string;
    anterior: string;
  };
}
