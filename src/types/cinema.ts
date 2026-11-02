/** The public REST contract; optional API fields are normalized to null on read. */
export interface NamedEntity {
  id: number;
  name: string;
}
export type Category = NamedEntity;
export type Director = NamedEntity;
export type Auditorium = NamedEntity;

export interface Movie {
  id: number;
  title: string;
  director_id: number | null;
  length: number | null;
  category_id: number | null;
  movie_summary: string | null;
  image: string | null;
}

export interface Screening {
  id: number;
  date: string;
  movie_id: number;
  auditorium_id: number;
}
export interface Seat {
  id: number;
  seat_number: number;
  row_label: string | null;
  auditorium_id: number;
}
export interface Ticket {
  id: number;
  user_id: number;
  seat_id: number;
  movie_screening_id: number;
  price: string | null;
}
export interface User {
  id: number;
  name: string;
  email: string;
}

export interface ResourceMap {
  movies: Movie;
  categories: Category;
  directors: Director;
  auditoriums: Auditorium;
  "movie-screenings": Screening;
  seats: Seat;
  tickets: Ticket;
  users: User;
}

export interface CreateResourceMap {
  movies: {
    title: string;
    director_id?: number | null;
    length?: number | null;
    category_id?: number | null;
    movie_summary?: string | null;
    image?: string | null;
  };
  categories: { name: string };
  directors: { name: string };
  auditoriums: { name: string };
  "movie-screenings": { date: string; movie_id: number; auditorium_id: number };
  seats: {
    seat_number: number;
    row_label?: string | null;
    auditorium_id: number;
  };
  tickets: {
    user_id: number;
    seat_id: number;
    movie_screening_id: number;
    price?: string | number | null;
  };
  users: { name: string; email: string; password: string };
}

export type ResourceName = keyof ResourceMap;
export type ResourceInput<R extends ResourceName> = CreateResourceMap[R];
export interface SeatSelection {
  screeningId: number | null;
  seatIds: number[];
}
