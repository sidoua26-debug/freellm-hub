#!/usr/bin/env python3
"""
FreeLLM Hub — Upstream Data Parser
Extracts strictly free-tier LLM APIs and models from:
https://github.com/open-free-llm-api/awesome-freellm-apis

Scope & Safety:
- Only extracts providers from <!-- BEGIN_PERMANENT_FREE --> and <!-- BEGIN_RENEWABLE -->
- Excludes all paid-only providers and paid pricing tiers
- Preserves free-tier classification: "permanent" vs "renewable"
- Extracts models, context windows, rate limits, and authentication criteria
- Outputs structured data.json
"""

import argparse
import datetime
import json
import os
import re
import sys
import urllib.request

DEFAULT_README_URL = "https://raw.githubusercontent.com/open-free-llm-api/awesome-freellm-apis/main/README.md"
DEFAULT_OUTPUT_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data.json")

def fetch_markdown(url_or_path: str) -> str:
    """Fetch markdown from remote URL or read from local filesystem."""
    if os.path.exists(url_or_path):
        print(f"Reading local markdown file: {url_or_path}")
        with open(url_or_path, "r", encoding="utf-8") as f:
            return f.read()

    print(f"Fetching markdown from: {url_or_path}")
    req = urllib.request.Request(
        url_or_path,
        headers={"User-Agent": "FreeLLM-Hub-Parser/1.0 (+https://github.com/)"}
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read().decode("utf-8")

def parse_markdown_table(table_text: str):
    """Parses a markdown table into headers and list of row dicts."""
    lines = [line.strip() for line in table_text.strip().split("\n") if line.strip().startswith("|")]
    if len(lines) < 2:
        return [], []
    headers = [c.strip() for c in lines[0].strip("|").split("|")]
    rows = []
    for line in lines[2:]:
        cols = [c.strip() for c in line.strip("|").split("|")]
        if len(cols) == len(headers):
            rows.append(dict(zip(headers, cols)))
        elif len(cols) > len(headers):
            # If extra pipes inside cells (e.g. arrows), join overflow into last cell
            merged = cols[:len(headers)-1] + ["|".join(cols[len(headers)-1:])]
            rows.append(dict(zip(headers, merged)))
    return headers, rows

def extract_link(html_or_md: str):
    """Extract URL and text from HTML <a> or markdown link [text](url)."""
    if not html_or_md:
        return "", ""
    # HTML tag: <a href="..." ...>text</a>
    m_html = re.search(r'<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)</a>', html_or_md, re.IGNORECASE)
    if m_html:
        url = m_html.group(1).strip()
        text = re.sub(r'<[^>]+>', '', m_html.group(2)).strip()
        return url, text
    # Markdown tag: [text](url)
    m_md = re.search(r'\[(.*?)\]\((.*?)\)', html_or_md)
    if m_md:
        return m_md.group(2).strip(), m_md.group(1).strip()
    return "", html_or_md.strip()

def clean_code(val: str) -> str:
    """Strip backticks and whitespace."""
    if not val:
        return ""
    return re.sub(r'^`|`$', '', val.strip()).strip()

def generate_slug(name: str) -> str:
    """Generate URL/DOM safe slug from name."""
    clean = re.sub(r'[^a-zA-Z0-9]+', '-', name.lower()).strip('-')
    return clean

def infer_model_modalities(model_name: str, model_id: str, provider_modalities: list) -> list:
    """Infer specific modalities for an individual model."""
    combined = (model_name + " " + model_id).lower()
    mods = set()
    if any(k in combined for k in ["chat", "instruct", "versatile", "gemma", "llama", "qwen", "mistral", "mixtral", "command", "deepseek", "jamba", "glm"]):
        mods.add("chat")
        mods.add("text")
    if any(k in combined for k in ["coder", "code", "codex"]):
        mods.add("code")
    if any(k in combined for k in ["embed", "embedding"]):
        mods.add("embeddings")
    if any(k in combined for k in ["vision", "vl", "ocr", "image", "visual"]):
        mods.add("vision")
        mods.add("image")
    if any(k in combined for k in ["reasoner", "r1", "reasoning", "think"]):
        mods.add("reasoning")
    if any(k in combined for k in ["audio", "voice", "speech", "whisper"]):
        mods.add("audio")

    # Fallback to chat/text if nothing specific matched
    if not mods:
        mods.add("chat")
        mods.add("text")

    return sorted(list(mods))

def parse_freellm_readme(md_content: str):
    """
    Extracts all free-tier providers and models from the README markdown content.
    Strictly restricted to PERMANENT_FREE and RENEWABLE sections.
    """
    # 1. Extract Permanent Free Tiers
    perm_match = re.search(r'<!-- BEGIN_PERMANENT_FREE -->(.*?)<!-- END_PERMANENT_FREE -->', md_content, re.DOTALL)
    if not perm_match:
        raise ValueError("Could not find <!-- BEGIN_PERMANENT_FREE --> block in README")
    _, perm_rows = parse_markdown_table(perm_match.group(1))

    # 2. Extract Renewable Credits
    renew_match = re.search(r'<!-- BEGIN_RENEWABLE -->(.*?)<!-- END_RENEWABLE -->', md_content, re.DOTALL)
    if not renew_match:
        raise ValueError("Could not find <!-- BEGIN_RENEWABLE --> block in README")
    _, renew_rows = parse_markdown_table(renew_match.group(1))

    # 3. Extract Quick Reference (Base URLs & Keys)
    quick_match = re.search(r'<!-- BEGIN_QUICK_REF -->(.*?)<!-- END_QUICK_REF -->', md_content, re.DOTALL)
    quick_by_prov = {}
    if quick_match:
        _, quick_rows = parse_markdown_table(quick_match.group(1))
        for r in quick_rows:
            p_name = r.get("Provider", "").strip()
            if p_name:
                quick_by_prov[p_name] = r

    # 4. Extract Best Free Models
    best_match = re.search(r'<!-- BEGIN_BEST_MODELS -->(.*?)<!-- END_BEST_MODELS -->', md_content, re.DOTALL)
    best_by_prov = {}
    if best_match:
        _, best_rows = parse_markdown_table(best_match.group(1))
        curr_p = None
        for r in best_rows:
            p = r.get("Provider", "").strip()
            if p:
                curr_p = p
            if curr_p:
                if curr_p not in best_by_prov:
                    best_by_prov[curr_p] = []
                best_by_prov[curr_p].append(r)

    providers = []
    seen_names = set()

    # Process Permanent Free
    for row in perm_rows:
        prov_name = row.get("Provider", "").strip()
        if not prov_name or prov_name in seen_names:
            continue
        seen_names.add(prov_name)

        free_models_count = 0
        try:
            free_models_count = int(re.sub(r'[^0-9]', '', row.get("Free Models", "0")))
        except Exception:
            free_models_count = 0

        cc_info = row.get("Credit Card?", "").strip()
        max_context = row.get("Max Context", "").strip()
        modalities_raw = row.get("Modalities", "")
        modalities = [m.strip().lower() for m in modalities_raw.split(",") if m.strip()]
        if "text" in modalities and "chat" not in modalities:
            modalities.insert(0, "chat")

        key_url, _ = extract_link(row.get("Get API Key", ""))

        # Merge with Quick Reference
        quick_info = quick_by_prov.get(prov_name, {})
        base_url = clean_code(quick_info.get("Base URL", ""))
        quick_key_url, _ = extract_link(quick_info.get("Get API Key", ""))
        if not key_url and quick_key_url:
            key_url = quick_key_url

        if not cc_info and quick_info.get("Credit Card?"):
            cc_info = quick_info.get("Credit Card?", "").strip()

        # Build Provider Object
        p_obj = {
            "id": generate_slug(prov_name),
            "name": prov_name,
            "tier_type": "permanent",
            "tier_label": "Always Free",
            "credit_model": None,
            "base_url": base_url,
            "signup_required": True,
            "api_key_required": True,
            "credit_card_required": False,
            "verification_type": cc_info if cc_info else "Email registration",
            "docs_url": key_url,
            "signup_url": key_url,
            "total_free_models": free_models_count,
            "max_context": max_context,
            "modalities": modalities,
            "free_quota": "See provider details",
            "models": []
        }

        # Check for anonymous access providers
        if prov_name == "LLM7.io":
            p_obj["signup_required"] = False
            p_obj["api_key_required"] = False
            p_obj["verification_type"] = "None (anonymous access available)"
            p_obj["free_quota"] = "10 RPM, 60 req/hr (anonymous); higher with free key"
        elif prov_name == "OVHcloud AI Endpoints":
            p_obj["signup_required"] = False
            p_obj["api_key_required"] = False
            p_obj["verification_type"] = "None (anonymous access available)"
            p_obj["free_quota"] = "2 RPM (anonymous)"
        elif cc_info.lower() == "no":
            p_obj["verification_type"] = "Email only (no credit card)"
        elif "phone" in cc_info.lower():
            p_obj["verification_type"] = "Phone verification"

        # Populate Best Models for this provider
        models_for_prov = best_by_prov.get(prov_name, [])
        for m_row in models_for_prov:
            m_url, m_name = extract_link(m_row.get("Best Free Model", ""))
            if not m_name:
                m_name = m_row.get("Best Free Model", "").strip()
            m_id = clean_code(m_row.get("Model ID", ""))
            m_ctx = m_row.get("Max Context", "").strip()
            m_rate = m_row.get("Rate Limit", "").strip()

            m_obj = {
                "name": m_name,
                "id": m_id or m_name,
                "context": m_ctx,
                "rate_limit": m_rate if m_rate else "Free tier",
                "info_url": m_url,
                "modalities": infer_model_modalities(m_name, m_id, modalities)
            }
            p_obj["models"].append(m_obj)

        if p_obj["models"]:
            rates = [m["rate_limit"] for m in p_obj["models"] if m["rate_limit"] and m["rate_limit"].lower() != "see provider"]
            if rates and p_obj["free_quota"] == "See provider details":
                p_obj["free_quota"] = rates[0]

        providers.append(p_obj)

    # Process Renewable Credits (e.g. OpenRouter)
    for row in renew_rows:
        prov_name = row.get("Provider", "").strip()
        if not prov_name or prov_name in seen_names:
            continue
        seen_names.add(prov_name)

        free_models_count = 0
        try:
            free_models_count = int(re.sub(r'[^0-9]', '', row.get("Free Models", "0")))
        except Exception:
            free_models_count = 0

        credit_model = row.get("Credit Model", "").strip()
        max_context = row.get("Max Context", "").strip()
        modalities_raw = row.get("Modalities", "")
        modalities = [m.strip().lower() for m in modalities_raw.split(",") if m.strip()]
        if "text" in modalities and "chat" not in modalities:
            modalities.insert(0, "chat")

        key_url, _ = extract_link(row.get("Get API Key", ""))

        quick_info = quick_by_prov.get(prov_name, {})
        base_url = clean_code(quick_info.get("Base URL", ""))
        quick_key_url, _ = extract_link(quick_info.get("Get API Key", ""))
        if not key_url and quick_key_url:
            key_url = quick_key_url

        p_obj = {
            "id": generate_slug(prov_name),
            "name": prov_name,
            "tier_type": "renewable",
            "tier_label": "Free Credits (Renews periodically)",
            "credit_model": credit_model,
            "base_url": base_url,
            "signup_required": True,
            "api_key_required": True,
            "credit_card_required": False,
            "verification_type": "Registration (Free Tier)",
            "docs_url": key_url,
            "signup_url": key_url,
            "total_free_models": free_models_count,
            "max_context": max_context,
            "modalities": modalities,
            "free_quota": credit_model or "Periodic free credits",
            "models": []
        }

        models_for_prov = best_by_prov.get(prov_name, [])
        for m_row in models_for_prov:
            m_url, m_name = extract_link(m_row.get("Best Free Model", ""))
            if not m_name:
                m_name = m_row.get("Best Free Model", "").strip()
            m_id = clean_code(m_row.get("Model ID", ""))
            m_ctx = m_row.get("Max Context", "").strip()
            m_rate = m_row.get("Rate Limit", "").strip()

            m_obj = {
                "name": m_name,
                "id": m_id or m_name,
                "context": m_ctx,
                "rate_limit": m_rate if m_rate else "Free credits",
                "info_url": m_url,
                "modalities": infer_model_modalities(m_name, m_id, modalities)
            }
            p_obj["models"].append(m_obj)

        providers.append(p_obj)

    total_featured_models = sum(len(p["models"]) for p in providers)
    perm_count = sum(1 for p in providers if p["tier_type"] == "permanent")
    renew_count = sum(1 for p in providers if p["tier_type"] == "renewable")

    dataset = {
        "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source_repo": "open-free-llm-api/awesome-freellm-apis",
        "stats": {
            "total_providers": len(providers),
            "permanent_free_providers": perm_count,
            "renewable_providers": renew_count,
            "total_featured_models": total_featured_models,
            "total_free_models_catalog": sum(p["total_free_models"] for p in providers)
        },
        "providers": providers
    }

    return dataset

def main():
    parser = argparse.ArgumentParser(description="Parse free-tier LLM APIs from awesome-freellm-apis")
    parser.add_argument("--source", default=DEFAULT_README_URL, help="URL or local path to README.md")
    parser.add_argument("--output", default=DEFAULT_OUTPUT_FILE, help="Path to write data.json")
    args = parser.parse_args()

    print(f"Starting FreeLLM Hub data parser at {datetime.datetime.now(datetime.timezone.utc).isoformat()}")
    try:
        content = fetch_markdown(args.source)
    except Exception as e:
        print(f"Error fetching from primary source {args.source}: {e}", file=sys.stderr)
        fallback = "/home/sid/.gemini/antigravity/brain/08fcc4dd-6a72-4ddc-b59f-a062133fce96/scratch/upstream_readme.md"
        if os.path.exists(fallback):
            print(f"Using cached scratch fallback: {fallback}")
            content = fetch_markdown(fallback)
        else:
            sys.exit(1)

    dataset = parse_freellm_readme(content)

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2, ensure_ascii=False)

    print(f"Successfully generated {args.output}")
    print(f"Providers parsed: {dataset['stats']['total_providers']} ({dataset['stats']['permanent_free_providers']} permanent, {dataset['stats']['renewable_providers']} renewable)")
    print(f"Featured models indexed: {dataset['stats']['total_featured_models']}")
    print(f"Catalog total free models: {dataset['stats']['total_free_models_catalog']}")

if __name__ == "__main__":
    main()
