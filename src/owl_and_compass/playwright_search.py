import sys
import json
import asyncio
from playwright.async_api import async_playwright
import urllib.parse
from owl_and_compass.llm_provider import resolve_llm_config
import http.client

async def query_llm_json(api_key: str, base_url: str, model: str, system_prompt: str, user_prompt: str) -> dict:
    url_parsed = urllib.parse.urlparse(base_url)
    host = url_parsed.netloc
    
    # Strip any port or path elements for the host connection
    if ":" in host:
        host_name = host.split(":")[0]
    else:
        host_name = host
        
    # Build complete path
    path = url_parsed.path.rstrip("/") + "/chat/completions"
    if url_parsed.query:
        path += "?" + url_parsed.query

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "response_format": {"type": "json_object"}
    }
    
    # Use appropriate connection port
    if url_parsed.scheme == "https":
        conn = http.client.HTTPSConnection(host_name)
    else:
        conn = http.client.HTTPConnection(host_name)
        
    conn.request("POST", path, json.dumps(body), headers)
    response = conn.getcall() if hasattr(conn, "getcall") else conn.getresponse()
    response_data = response.read().decode("utf-8")
    conn.close()
    
    if response.status != 200:
        raise ValueError(f"LLM request failed with status {response.status}: {response_data}")
        
    return json.loads(response_data)

async def search_founders(query: str):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        )
        page = await context.new_page()
        
        # Navigate to DuckDuckGo HTML-only search which is extremely scrape-friendly
        search_url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
        await page.goto(search_url)
        
        results = []
        result_elements = await page.locator(".result").all()
        for element in result_elements[:4]:
            link_el = element.locator(".result__url")
            snippet_el = element.locator(".result__snippet")
            title_el = element.locator(".result__title")
            
            url = await link_el.get_attribute("href") if await link_el.count() > 0 else ""
            title = await title_el.inner_text() if await title_el.count() > 0 else ""
            snippet = await snippet_el.inner_text() if await snippet_el.count() > 0 else ""
            
            if url:
                # Clean DuckDuckGo redirect url if present
                if "uddg=" in url:
                    parsed = urllib.parse.urlparse(url)
                    params = urllib.parse.parse_qs(parsed.query)
                    if "uddg" in params:
                        url = params["uddg"][0]
                results.append({"title": title, "url": url, "snippet": snippet})
        
        await browser.close()
        return results

async def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No query supplied"}))
        return
        
    query = sys.argv[1]
    
    try:
        results = await search_founders(query)
    except Exception as e:
        print(json.dumps({"error": f"Playwright search failed: {str(e)}"}))
        return
        
    if not results:
        print(json.dumps({"candidates": []}))
        return
        
    # Resolve LLM credentials
    api_key, base_url, model = resolve_llm_config()
    if not api_key:
        print(json.dumps({"error": "LLM API Key not configured"}))
        return
        
    system_prompt = """You are a professional venture research assistant. Extract startup founders and companies from the provided web search results.
Return a JSON object containing a 'candidates' array, where each object matches this schema:
{
  "full_name": "string",
  "company_name": "string",
  "company_stage": "Pre-Seed" | "Seed" | "Series A" | "Series B" | "Unknown",
  "industry": "string",
  "bio": "string (founder background and experience)",
  "company_description": "string (what the company does)",
  "tech_stack": "string (comma-separated list of key technologies)"
}

Rules:
1. ONLY extract real people and companies found in the search results. DO NOT hallucinate.
2. If name or company information is missing, do not include that item.
3. Return ONLY a valid JSON object."""

    user_prompt = "Web Search Results:\n\n"
    for r in results:
        user_prompt += f"Title: {r['title']}\nURL: {r['url']}\nSnippet: {r['snippet']}\n\n"
        
    try:
        llm_res = await query_llm_json(api_key, base_url, model, system_prompt, user_prompt)
        content = llm_res["choices"][0]["message"]["content"]
        if "```" in content:
            content = content.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(content)
        print(json.dumps(parsed))
    except Exception as e:
        print(json.dumps({"error": f"LLM extraction failed: {str(e)}"}))

if __name__ == "__main__":
    asyncio.run(main())
