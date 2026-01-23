import { Capability } from "./capability";
export interface Manifest {
  $schema: string;
  version: string;
  metadata: {
    name: string;
    description: string;
    author?: string;
  };
  capabilities: Record<string, Capability>;
  definitions?: Record<string, any>;
  context?: any;
}
