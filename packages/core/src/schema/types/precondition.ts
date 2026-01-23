import { Handler } from "./handler";
import { PreconditionType } from "./preconditionType";
export interface Precondition {
  type: PreconditionType;
  checker: Handler;
  description: string;
  errorMessage: string;
  isAsync?: boolean;
}
