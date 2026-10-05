import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

const VALID_TABLES = ["emissoes", "clientes", "cartoes", "contas"] as const;
type TableName = (typeof VALID_TABLES)[number];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth via x-api-key header (service role key)
    const apiKey = req.headers.get("x-api-key");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!apiKey || apiKey !== serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Unauthorized. Provide valid x-api-key header." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey!
    );

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    // Path: /n8n-api/{table} or /n8n-api/{table}/{id}
    const table = pathParts[pathParts.length - 2] as TableName | undefined ?? pathParts[pathParts.length - 1] as TableName;
    const id = pathParts.length > 1 && !VALID_TABLES.includes(pathParts[pathParts.length - 1] as TableName)
      ? pathParts[pathParts.length - 1]
      : null;

    // Determine table from path
    const tableName = id ? pathParts[pathParts.length - 2] as TableName : table;

    if (!tableName || !VALID_TABLES.includes(tableName)) {
      return new Response(
        JSON.stringify({
          error: `Invalid table. Use one of: ${VALID_TABLES.join(", ")}`,
          usage: {
            list: "GET /n8n-api/{table}",
            get: "GET /n8n-api/{table}/{id}",
            create: "POST /n8n-api/{table}",
            update: "PATCH /n8n-api/{table}/{id}",
            delete: "DELETE /n8n-api/{table}/{id}",
            query_params: "?limit=50&offset=0&order_by=created_at&order=desc",
          },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const respond = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // GET - List or Get by ID
    if (req.method === "GET") {
      if (id) {
        const { data, error } = await supabase
          .from(tableName)
          .select("*")
          .eq("id", id)
          .single();
        if (error) return respond({ error: error.message }, 404);
        return respond(data);
      }

      const limit = parseInt(url.searchParams.get("limit") || "50");
      const offset = parseInt(url.searchParams.get("offset") || "0");
      const orderBy = url.searchParams.get("order_by") || "created_at";
      const order = url.searchParams.get("order") === "asc" ? true : false;

      // Filters: ?filter_campo=valor
      let query = supabase.from(tableName).select("*", { count: "exact" });

      for (const [key, value] of url.searchParams.entries()) {
        if (key.startsWith("filter_")) {
          const column = key.replace("filter_", "");
          query = query.eq(column, value);
        }
      }

      const { data, error, count } = await query
        .order(orderBy, { ascending: order })
        .range(offset, offset + limit - 1);

      if (error) return respond({ error: error.message }, 400);
      return respond({ data, total: count, limit, offset });
    }

    // POST - Create
    if (req.method === "POST") {
      const body = await req.json();
      const { data, error } = await supabase
        .from(tableName)
        .insert(body)
        .select();
      if (error) return respond({ error: error.message }, 400);
      return respond(data, 201);
    }

    // PATCH - Update
    if (req.method === "PATCH") {
      if (!id) return respond({ error: "ID required for update" }, 400);
      const body = await req.json();
      const { data, error } = await supabase
        .from(tableName)
        .update(body)
        .eq("id", id)
        .select();
      if (error) return respond({ error: error.message }, 400);
      return respond(data);
    }

    // DELETE
    if (req.method === "DELETE") {
      if (!id) return respond({ error: "ID required for delete" }, 400);
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq("id", id);
      if (error) return respond({ error: error.message }, 400);
      return respond({ success: true });
    }

    return respond({ error: "Method not allowed" }, 405);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
