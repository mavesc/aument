import { Handler } from "./handler";
import { Parameter } from "./parameter";
import { Precondition } from "./precondition";
import { Entity } from "./entity";
export interface Capability {
  id: string;
  displayName: string;
  description: string;
  examples?: string[];
  category?: string;

  handler: Handler;
  parameters: Parameter[];
  preconditions?: Precondition[];
  sideEffects?: Entity[];
  requiresConfirmation?: boolean;

  undoHandler?: Handler;
  undoParameters?: Parameter[];
  undoPreconditions?: Precondition[];
  undoSideEffects?: Entity[];

  isAsync?: boolean;
}
