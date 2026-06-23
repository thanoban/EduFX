create table if not exists students (
  id bigint generated always as identity primary key,
  name text not null,
  email text unique not null,
  diagnostic_completed boolean default false,
  created_at timestamp default now()
);

create table if not exists subtopics (
  id bigint generated always as identity primary key,
  group_name text not null,
  title text not null,
  order_index int not null
);

create table if not exists content (
  id bigint generated always as identity primary key,
  subtopic_id bigint references subtopics(id),
  level text not null,
  body text not null
);

create table if not exists questions (
  id bigint generated always as identity primary key,
  subtopic_id bigint references subtopics(id),
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_answer text not null,
  difficulty text not null,
  source text not null,
  stage text not null,
  student_id bigint null,
  is_diagnostic boolean default false,
  created_at timestamp default now()
);

create table if not exists student_progress (
  id bigint generated always as identity primary key,
  student_id bigint references students(id),
  subtopic_id bigint references subtopics(id),
  current_level text not null,
  last_studied_date date null,
  last_quiz_score int default 0,
  total_sessions int default 0,
  unique(student_id, subtopic_id)
);

create table if not exists session_summary (
  id bigint generated always as identity primary key,
  student_id bigint references students(id),
  subtopic_id bigint references subtopics(id),
  session_date date default current_date,
  quiz_score int default 0,
  focus_score int null,
  phone_percent int default 0,
  drowsy_percent int default 0,
  away_percent int default 0,
  talking_percent int default 0,
  absent_percent int default 0,
  webcam_enabled boolean default false,
  total_questions int default 0,
  correct_answers int default 0,
  created_at timestamp default now()
);

create table if not exists behaviour_logs (
  id bigint generated always as identity primary key,
  student_id bigint references students(id),
  session_id bigint references session_summary(id),
  timestamp timestamp default now(),
  face_detected boolean default true,
  looking_away boolean default false,
  phone_detected boolean default false,
  drowsy boolean default false,
  multiple_persons boolean default false,
  talking boolean default false,
  absent boolean default false,
  focus_score int default 100
);

create table if not exists quiz_attempts (
  id bigint generated always as identity primary key,
  student_id bigint references students(id),
  session_id bigint references session_summary(id),
  question_id bigint references questions(id),
  subtopic_id bigint references subtopics(id),
  student_answer text not null,
  correct_answer text not null,
  is_correct boolean not null,
  explanation text null,
  created_at timestamp default now()
);
