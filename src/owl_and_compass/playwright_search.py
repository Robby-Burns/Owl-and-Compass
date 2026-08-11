import sys
import json
import asyncio
import urllib.parse
import urllib.request
from playwright.async_api import async_playwright
from owl_and_compass.llm_provider import resolve_llm_config


def query_llm_json(api_key: str, base_url: str, model: str, system_prompt: str, user_prompt: str) -> dict:
    """Call any OpenAI-compatible chat completions endpoint synchronously."""
    endpoint = base_url.rstrip("/") + "/chat/completions"

    # Gemini's OpenAI-compat endpoint requires the key as a query param
    if "googleapis.com" in endpoint:
        endpoint += f"?key={api_key}"
        auth_header = None
    else:
        auth_header = f"Bearer {api_key}"

    body = json.dumps({
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "response_format": {"type": "json_object"}
    }).encode("utf-8")

    headers = {"Content-Type": "application/json"}
    if auth_header:
        headers["Authorization"] = auth_header

    req = urllib.request.Request(endpoint, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    return data


async def search_founders(query: str) -> list:
    """Use Playwright to scrape DuckDuckGo HTML search and return result snippets."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
        )
        page = await context.new_page()

        search_url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
        await page.goto(search_url, wait_until="domcontentloaded", timeout=20000)

        results = []
        result_elements = await page.locator(".result").all()
        for element in result_elements[:6]:
            title_el = element.locator(".result__title")
            snippet_el = element.locator(".result__snippet")
            url_el = element.locator(".result__url")

            title = await title_el.inner_text() if await title_el.count() > 0 else ""
            snippet = await snippet_el.inner_text() if await snippet_el.count() > 0 else ""
            url = await url_el.inner_text() if await url_el.count() > 0 else ""

            if title or snippet:
                results.append({"title": title.strip(), "url": url.strip(), "snippet": snippet.strip()})

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

    # Resolve LLM credentials from environment
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
1. ONLY extract real people and companies found in the search results. DO NOT hallucinate or invent names.
2. Skip any result where the full name or company name cannot be determined.
3. Return ONLY a valid JSON object with no markdown formatting."""

    user_prompt = "Web Search Results:\n\n"
    for r in results:
        user_prompt += f"Title: {r['title']}\nURL: {r['url']}\nSnippet: {r['snippet']}\n\n"

    try:
        llm_res = query_llm_json(api_key, base_url, model, system_prompt, user_prompt)
        content = llm_res["choices"][0]["message"]["content"]
        if "```" in content:
            content = content.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(content)
        print(json.dumps(parsed))
    except Exception as e:
        print(json.dumps({"error": f"LLM extraction failed: {str(e)}"}))


if __name__ == "__main__":
    asyncio.run(main())
