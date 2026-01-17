export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  userId: string;
  color: string;
  width: number;
  points: Point[];
}

export interface UserCursor {
  id: string;
  x: number;
  y: number;
  name: string;
}

export interface ReqStatePayload {
  requesterId: string;
}

export interface SyncStatePayload {
  strokes: Stroke[];
}
