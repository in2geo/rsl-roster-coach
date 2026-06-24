const names = ['Brogni', 'Abyssal', 'Boneblood', 'Bystophus', 'Aza the Corruptor'];

for (const name of names) {
  // Direct lookup
  const url = `https://raid.fandom.com/api.php?` + new URLSearchParams({
    action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main',
    titles: name, redirects: '1', format: 'json', formatversion: '2',
  });
  const res  = await fetch(url);
  const data = await res.json();
  const page = data?.query?.pages?.[0];

  if (page && !page.missing) {
    console.log(`✅ ${name} → found as "${page.title}"`);
    continue;
  }

  // Search fallback
  const surl = `https://raid.fandom.com/api.php?` + new URLSearchParams({
    action: 'query', list: 'search', srsearch: name, srlimit: '3',
    srnamespace: '0', format: 'json', formatversion: '2',
  });
  const sres  = await fetch(surl);
  const sdata = await sres.json();
  const hits  = sdata?.query?.search?.map(s => s.title) ?? [];
  console.log(`❌ ${name} → not found directly. Search results: ${hits.join(', ') || 'none'}`);
}
