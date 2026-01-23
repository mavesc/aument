import { CollectionApproach } from "./collectionApproach";
import { ParameterType } from "./parameterType";
import { Validator } from "./validator";
export interface Parameter {
  name: string;
  type: ParameterType;
  isRequired: boolean;
  description: string;
  defaultValue?: any;
  validator?: Validator;
  examples?: any[];
  isSensitive?: boolean;
  collectionApproach?: CollectionApproach;
}
