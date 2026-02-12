import httpx
import json
import re
import sys
from urllib.parse import quote_plus
from datetime import datetime

def format_date(date_str):
    """Format an ISO date string to a readable format."""
    if not date_str:
        return 'N/A'
    try:
        dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        return dt.strftime('%d %b %Y')
    except:
        return date_str

def search_adobe_stock(query, page=1, ai_only=False, raw=False):
    print(f"Searching for: {query} (Page {page})...")
    
    # HTTP/2 is required to mimic a real browser and avoid Cloudflare blocks.
    client = httpx.Client(http2=True, timeout=30.0)
    
    encoded_query = quote_plus(query)
    # Build URL with optional page and filter params
    url = f"https://trackadobestock.com/search?q={encoded_query}"
    if ai_only:
        url += "&generative_ai=only"
    if page > 1:
        url += f"&page={page}"
    url += "&_rsc=1gn38"
    
    # Full cookies from the browser INCLUDING auth session tokens.
    # Without the session token, the server redirects to /auth/login.
    cookies = {
        "__stripe_mid": "b4730762-4a41-47fc-85c9-53cdefb930113a0fb8",
        "__Host-next-auth.csrf-token": "14fbdc7e18b633140ce99eb5ca6c8d2aa2504beef50ae53d13ed288fbafc696e%7Cfd754080b5ab4c4667f730c8d475564b8e7c2a9d76fc2b9cb966ac3d1da0de7b",
        "__Secure-next-auth.callback-url": "https%3A%2F%2Ftrackadobestock.com",
        "__Secure-next-auth.session-token": "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..pyDITVjsut1EoIBD.jD1pgamUvITSjIU3E_DfRAKDezuQchgmqkc9vxQ42IpYjmolAqkpnJHssMG6sdZiCyhN96i9IxWFHE5Q8fz09oE6wgKEjRDfQrldwqf7adD0vW-TlK1EcltlnwV58ROlgLvCOdR0uJam7buw8x8g95VbgMGH75luy7x6CqmMMcdsHIaZVOY919oEHkUnhE-tuhUJY72x_8x2nCxutjNGrMN3WYni1u50Z2bfqmMYObK3EVDKKxK2jmSMo31KX26xBKi2kOB26BGmxyBtKYvyiEWwAgjqT2xAJEK8J4jB1PKJjWbjxoKrA-tIaWgIoGUKWkPIvWYN9BRRLjNWvjwnUyQ6pIdiSEFileLovlrWRfkt1g3sezoGaGvYWmrXSJ5RJiqUYdre_63NLRscyzMsfTZw4zg9VPBWUbv_WqMR7uWgqGnFLtbeWpsksT2DNt6M9IQ_92v6WSMT2v80w7lvPOpQMCl3d7Cn.6hdZTN0RhlJpGJTM-k2qqQ",
    }

    # Headers matching the exact browser request.
    headers = {
        'accept': '*/*',
        'accept-language': 'en-GB,en;q=0.9,ur-PK;q=0.8,ur;q=0.7,en-US;q=0.6',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'referer': 'https://trackadobestock.com/search',
        'rsc': '1',
        'next-router-state-tree': '%5B%22%22%2C%7B%22children%22%3A%5B%22search%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%2Ctrue%5D',
        'next-url': '/search',
        'sec-ch-ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
    }

    try:
        response = client.get(url, headers=headers, cookies=cookies)
        response.raise_for_status()
        
        content = response.text
        
        # The RSC response is chunked. Find the JSON object containing images.
        marker = '{"query":"'
        start_idx = content.find(marker)
        
        data = None
        if start_idx != -1:
            # Count braces to find the matching closing brace
            depth = 0
            for i in range(start_idx, len(content)):
                if content[i] == '{':
                    depth += 1
                elif content[i] == '}':
                    depth -= 1
                    if depth == 0:
                        json_str = content[start_idx:i+1]
                        data = json.loads(json_str)
                        break
        
        if data:
            images = data.get('images', [])
            usage = data.get('usageData', {})
            print(f"Page {page} — Found {len(images)} results (Plan: {usage.get('plan', 'N/A')}, Searches: {usage.get('searchesUsed', '?')}/{usage.get('searchesLimit', '?')})\n")
            
            # If --raw flag, dump complete JSON of first image for debugging
            if raw and images:
                print("=" * 60)
                print("RAW JSON - First Image (all available fields):")
                print("=" * 60)
                print(json.dumps(images[0], indent=2))
                print("=" * 60)
                print(f"\nTop-level data keys: {list(data.keys())}")
                print()
            
            for idx, img in enumerate(images, 1):
                # Basic info
                title = img.get('title', 'N/A')
                is_ai = img.get('isAI', False)
                ai_tag = " [AI-Generated]" if is_ai else ""
                
                print(f"{'='*60}")
                print(f"  #{idx} {title}{ai_tag}")
                print(f"{'='*60}")
                
                # Stats
                stock_id = img.get('id', 'N/A')
                downloads = img.get('downloads', 'N/A')
                premium = img.get('premium', 'N/A')
                
                print(f"  Stock ID:     {stock_id}")
                print(f"  Downloads:    {downloads}")
                print(f"  Premium:      {premium}")
                
                # Metadata
                creator = img.get('creator', 'N/A')
                creator_id = img.get('creatorId', '')
                media_type = img.get('mediaType', 'N/A')
                category = img.get('category', 'N/A')
                content_type = img.get('contentType', 'N/A')
                dimensions = img.get('dimensions', 'N/A')
                creation_date = img.get('creationDate', '')
                
                creator_str = f"{creator} (ID: {creator_id})" if creator_id else creator
                print(f"  Creator:      {creator_str}")
                print(f"  Type:         {media_type} ({content_type})")
                print(f"  Category:     {category}")
                print(f"  Dimensions:   {dimensions}")
                if creation_date:
                    print(f"  Upload Date:  {format_date(creation_date)}")
                
                # Keywords (comes as comma-separated string from the title)
                keywords = img.get('keywords', '')
                if keywords:
                    kw_list = [k.strip() for k in keywords.split(',') if k.strip()] if isinstance(keywords, str) else keywords
                    print(f"  Keywords:     {', '.join(kw_list[:20])}")
                    print(f"  KW Count:     {len(kw_list)}")
                
                # URLs
                thumb = img.get('thumbnailUrl', 'N/A')
                print(f"  Thumbnail:    {thumb}")
                print(f"  Stock URL:    https://stock.adobe.com/{stock_id}")
                
                print()
        else:
            print("Could not find image data in the response. The RSC format might have changed.")
            print("\nResponse Preview (first 3000 chars):")
            print(content[:3000])

    except httpx.HTTPStatusError as e:
        print(f"HTTP Error: {e.response.status_code}")
        print(f"Response: {e.response.text[:1000]}")
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    raw = '--raw' in sys.argv
    ai_only = '--ai-only' in sys.argv
    
    # Parse --page N
    page = 1
    args = sys.argv[1:]
    clean_args = []
    i = 0
    while i < len(args):
        if args[i] == '--page' and i + 1 < len(args):
            page = int(args[i + 1])
            i += 2
        elif args[i] in ('--raw', '--ai-only'):
            i += 1
        else:
            clean_args.append(args[i])
            i += 1
    
    query = clean_args[0] if clean_args else "nature"
    search_adobe_stock(query, page=page, ai_only=ai_only, raw=raw)

