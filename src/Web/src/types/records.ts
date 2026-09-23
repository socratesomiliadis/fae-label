export type Row<T = Data> = {
  id: string;
  kind: string;
  key: string;
  version: number;
  updatedAt: string;
  data: T;
};

export type Data = Record<string, any>;

export type Preview = {
  id: string;
  pdfUrl: string;
  imageUrl: string;
  issues: string[];
  lot: string;
  expiry: string;
};

export type User = { name: string; role: string };
