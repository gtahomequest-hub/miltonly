interface SchemaScriptProps {
  schemas: Record<string, unknown>[];
}

export default function SchemaScript({ schemas }: SchemaScriptProps) {
  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}
