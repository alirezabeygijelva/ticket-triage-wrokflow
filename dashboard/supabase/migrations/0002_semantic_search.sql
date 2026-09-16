create extension if not exists vector;
create table faq ( id uuid primary key default gen_random_uuid(), question text not null, answer text not null, embedding vector(768) );
alter table faq add column content text;
alter table faq add column metadata jsonb;
alter table faq drop column embedding;
alter table faq add column embedding vector(3072);
alter table faq drop column question;
alter table faq drop column answer;

alter table tickets add column source text;

create or replace function match_documents (
  query_embedding vector(3072),
  match_count int default null,
  filter jsonb default '{}'
) returns table (id uuid, content text, metadata jsonb, similarity float)
language plpgsql as $$
begin
  return query
  select faq.id, faq.content, faq.metadata,
    1 - (faq.embedding <=> query_embedding) as similarity
  from faq
  where faq.metadata @> filter
  order by faq.embedding <=> query_embedding
  limit match_count;
end;
$$;