import { Handler } from "./handler";
export interface Validator {
  min?: number;
  max?: number;
  pattern?: string;
  enum?: Array<{
    value: string;
    label: string;
  }>;
  custom?: Handler;
  isAsync?: boolean;
}
