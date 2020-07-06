
export interface IndexDef {
  key: string;
  auto?: boolean;
  unique?: boolean;
  sparse?: boolean;
  required?: boolean;
  gen?: string;
}
