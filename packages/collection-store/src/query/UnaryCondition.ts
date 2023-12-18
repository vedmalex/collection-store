export type UnaryCondition = (v: any) => boolean
export type UnaryConditionOperation = {
  [key: string]: UnaryCondition | UnaryConditionOperation
}
