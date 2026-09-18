/**
 * FreeLLM Hub — Frontend Application Logic
 * Pure vanilla ES6+, zero external runtime dependencies.
 */

(() => {
  'use strict';

  // Application State
  const state = {
    providers: [],
    stats: {},
    searchQuery: '',
    tierFilter: 'all',
    modalityFilter: 'all',
    authFilter: 'all',
    activeView: 'cards',
    currentSnippetProvider: null,
    currentSnippetLang: 'python'
  };

  // DOM Elements Cache
  const elements = {
    statProviders: document.getElementById('statProviders'),
    statPermanent: document.getElementById('statPermanent'),
    statRenewable: document.getElementById('statRenewable'),
    statModels: document.getElementById('statModels'),
    statCatalog: document.getElementById('statCatalog'),
    searchInput: document.getElementById('searchInput'),
    btnViewCards: document.getElementById('btnViewCards'),
    btnViewTable: document.getElementById('btnViewTable'),
    cardsView: document.getElementById('cardsView'),
    tableView: document.getElementById('tableView'),
    tableBody: document.getElementById('tableBody'),
    emptyState: document.getElementById('emptyState'),
    resultsCount: document.getElementById('resultsCount'),
    btnResetFilters: document.getElementById('btnResetFilters'),
    btnEmptyReset: document.getElementById('btnEmptyReset'),
    tierFilterGroup: document.getElementById('tierFilterGroup'),
    modalityFilterGroup: document.getElementById('modalityFilterGroup'),
    authFilterGroup: document.getElementById('authFilterGroup'),
    btnQuickGuide: document.getElementById('btnQuickGuide'),
    guideModal: document.getElementById('guideModal'),
    btnCloseGuide: document.getElementById('btnCloseGuide'),
    snippetModal: document.getElementById('snippetModal'),
    btnCloseSnippet: document.getElementById('btnCloseSnippet'),
    snippetModalTitle: document.getElementById('snippetModalTitle'),
    snippetProviderMeta: document.getElementById('snippetProviderMeta'),
    snippetCode: document.getElementById('snippetCode'),
    btnCopySnippet: document.getElementById('btnCopySnippet')
  };

  // Initialize App
  async function init() {
    setupEventListeners();
    await loadData();
  }

  // Fetch data.json
  async function loadData() {
    try {
      elements.resultsCount.textContent = 'Fetching free-tier providers...';
      const res = await fetch('data.json');
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      const data = await res.json();
      state.providers = data.providers || [];
      state.stats = data.stats || {};

      renderStats();
      renderProviders();
    } catch (err) {
      console.error('Failed to load data.json:', err);
      elements.resultsCount.innerHTML = `
        <span style="color: #f87171;">Failed to load data.json (${err.message}). Ensure data.json exists in root directory.</span>
      `;
    }
  }

  // Render Stats Grid
  function renderStats() {
    if (elements.statProviders) elements.statProviders.textContent = state.stats.total_providers || state.providers.length;
    if (elements.statPermanent) elements.statPermanent.textContent = state.stats.permanent_free_providers || 0;
    if (elements.statRenewable) elements.statRenewable.textContent = state.stats.renewable_providers || 0;
    if (elements.statModels) elements.statModels.textContent = state.stats.total_featured_models || 0;
    if (elements.statCatalog) elements.statCatalog.textContent = (state.stats.total_free_models_catalog || 0) + '+';
  }

  // Filter Providers
  function getFilteredProviders() {
    const q = state.searchQuery.trim().toLowerCase();

    return state.providers.filter(p => {
      // 1. Tier Type Filter
      if (state.tierFilter !== 'all') {
        if (p.tier_type !== state.tierFilter) return false;
      }

      // 2. Modality Filter
      if (state.modalityFilter !== 'all') {
        const hasModInProv = (p.modalities || []).map(m => m.toLowerCase()).includes(state.modalityFilter);
        const hasModInModels = (p.models || []).some(m => (m.modalities || []).map(x => x.toLowerCase()).includes(state.modalityFilter));
        if (!hasModInProv && !hasModInModels) return false;
      }

      // 3. Auth / Requirements Filter
      if (state.authFilter !== 'all') {
        if (state.authFilter === 'no-key') {
          if (p.api_key_required !== false && p.signup_required !== false) return false;
        } else if (state.authFilter === 'email-only') {
          const v = (p.verification_type || '').toLowerCase();
          if (!v.includes('email') && !v.includes('no')) return false;
        } else if (state.authFilter === 'no-card') {
          if (p.credit_card_required === true) return false;
        }
      }

      // 4. Search Query Filter
      if (q) {
        const nameMatch = p.name.toLowerCase().includes(q);
        const urlMatch = (p.base_url || '').toLowerCase().includes(q);
        const quotaMatch = (p.free_quota || '').toLowerCase().includes(q);
        const modelMatch = (p.models || []).some(m =>
          (m.name || '').toLowerCase().includes(q) ||
          (m.id || '').toLowerCase().includes(q)
        );
        if (!nameMatch && !urlMatch && !quotaMatch && !modelMatch) return false;
      }

      return true;
    });
  }

  // Render Providers List (Cards or Table)
  function renderProviders() {
    const filtered = getFilteredProviders();
    const hasActiveFilters = Boolean(
      state.searchQuery ||
      state.tierFilter !== 'all' ||
      state.modalityFilter !== 'all' ||
      state.authFilter !== 'all'
    );

    // Update Counter & Reset Button
    if (filtered.length === state.providers.length) {
      elements.resultsCount.innerHTML = `Showing all <strong>${filtered.length}</strong> free-tier providers`;
    } else {
      elements.resultsCount.innerHTML = `Showing <strong>${filtered.length}</strong> of ${state.providers.length} free-tier providers`;
    }
    elements.btnResetFilters.style.display = hasActiveFilters ? 'inline' : 'none';

    // Handle Empty State
    if (filtered.length === 0) {
      elements.cardsView.style.display = 'none';
      elements.tableView.style.display = 'none';
      elements.emptyState.style.display = 'block';
      return;
    }

    elements.emptyState.style.display = 'none';

    if (state.activeView === 'cards') {
      elements.cardsView.style.display = 'grid';
      elements.tableView.style.display = 'none';
      renderCards(filtered);
    } else {
      elements.cardsView.style.display = 'none';
      elements.tableView.style.display = 'block';
      renderTable(filtered);
    }
  }

  // Render Cards View
  function renderCards(providers) {
    elements.cardsView.innerHTML = providers.map(p => {
      const isPermanent = p.tier_type === 'permanent';
      const tierBadgeClass = isPermanent ? 'badge-permanent' : 'badge-renewable';
      const tierLabel = isPermanent ? 'Always Free' : 'Free Credits (Renews)';

      const isNoKey = p.api_key_required === false;
      const authHighlight = isNoKey ? 'highlight-no-key' : '';
      const authLabel = isNoKey ? '🔓 No API Key Required (Anon)' : `🔑 ${escapeHtml(p.verification_type || 'Registration Required')}`;

      // Featured Models markup
      const modelsMarkup = (p.models && p.models.length > 0)
        ? p.models.map(m => `
            <div class="model-item">
              <div class="model-name-id">
                <span class="model-name" title="${escapeHtml(m.name)}">${escapeHtml(m.name)}</span>
                <span class="model-id" title="Click to copy Model ID" onclick="window.FreeLLM.copyModelId(event, '${escapeHtml(m.id)}')">
                  <code>${escapeHtml(m.id)}</code>
                </span>
              </div>
              <div class="model-meta">
                ${m.context ? `<span class="context-badge" title="Context Window">${escapeHtml(m.context)}</span>` : ''}
              </div>
            </div>
          `).join('')
        : `<div style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">Refer to provider dashboard for full model list</div>`;

      // Tags markup
      const tagsMarkup = (p.modalities || []).map(m => `
        <span class="tag">${escapeHtml(m)}</span>
      `).join('');

      return `
        <article class="provider-card" data-provider-id="${escapeHtml(p.id)}">
          <div class="card-header">
            <div class="provider-title-wrap">
              <h3 class="provider-name">
                ${escapeHtml(p.name)}
              </h3>
              <div style="display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;">
                <span class="badge ${tierBadgeClass}">
                  <span class="badge-dot"></span>
                  ${tierLabel}
                </span>
                ${p.total_free_models ? `<span class="badge badge-model-count">${p.total_free_models} free models</span>` : ''}
              </div>
            </div>
          </div>

          <div class="card-auth-info">
            <span class="auth-item ${authHighlight}">
              ${authLabel}
            </span>
          </div>

          <!-- Base URL Box -->
          ${p.base_url ? `
            <div class="endpoint-box">
              <span class="endpoint-text" title="${escapeHtml(p.base_url)}">${escapeHtml(p.base_url)}</span>
              <button class="btn-copy" title="Copy Base URL" onclick="window.FreeLLM.copyEndpoint(event, '${escapeHtml(p.base_url)}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </button>
            </div>
          ` : ''}

          <!-- Free Quota / Rate Limit Banner -->
          <div class="rate-limit-banner ${!isPermanent ? 'credit-model-banner' : ''}">
            <strong>Free Quota:</strong> ${escapeHtml(p.free_quota || 'Standard free tier')}
            ${p.credit_model ? `<div style="margin-top: 0.2rem; font-size: 0.75rem; color: #38bdf8;">${escapeHtml(p.credit_model)}</div>` : ''}
          </div>

          <!-- Models Section -->
          <div class="card-models-section">
            <div class="models-header-label">Top Models (${p.models ? p.models.length : 0})</div>
            <div class="models-list">
              ${modelsMarkup}
            </div>
          </div>

          <!-- Modalities Tags -->
          <div class="card-tags">
            ${tagsMarkup}
          </div>

          <!-- Card Actions -->
          <div class="card-actions">
            <a href="${escapeHtml(p.signup_url || p.docs_url || '#')}" target="_blank" rel="noopener" class="btn-action-primary">
              Get API Key →
            </a>
            <button class="btn-action-secondary" onclick="window.FreeLLM.openSnippet('${escapeHtml(p.id)}')">
              Config </>
            </button>
          </div>
        </article>
      `;
    }).join('');
  }

  // Render Table View
  function renderTable(providers) {
    elements.tableBody.innerHTML = providers.map(p => {
      const isPermanent = p.tier_type === 'permanent';
      const tierBadgeClass = isPermanent ? 'badge-permanent' : 'badge-renewable';
      const tierLabel = isPermanent ? 'Always Free' : 'Renewable';

      const isNoKey = p.api_key_required === false;
      const authLabel = isNoKey ? '<span style="color: #34d399; font-weight: 600;">🔓 No Key Needed</span>' : escapeHtml(p.verification_type || 'Registration');

      const modelsSummary = (p.models || []).slice(0, 3).map(m => `
        <div style="font-size: 0.78rem;">
          <span style="font-weight: 500;">${escapeHtml(m.name)}</span>
          ${m.context ? `<code style="font-size: 0.7rem; color: var(--text-muted);">(${escapeHtml(m.context)})</code>` : ''}
        </div>
      `).join('');

      return `
        <tr>
          <td>
            <div class="table-prov-name">
              <span>${escapeHtml(p.name)}</span>
              <span class="badge ${tierBadgeClass}" style="width: fit-content;">
                <span class="badge-dot"></span>
                ${tierLabel}
              </span>
            </div>
          </td>
          <td>
            <div style="font-weight: 500; font-size: 0.8rem;">${escapeHtml(p.free_quota || 'Standard')}</div>
            ${p.total_free_models ? `<div style="font-size: 0.75rem; color: var(--text-muted);">${p.total_free_models} models</div>` : ''}
          </td>
          <td style="font-size: 0.8rem;">
            ${authLabel}
          </td>
          <td>
            ${modelsSummary}
            ${(p.models && p.models.length > 3) ? `<span style="font-size: 0.7rem; color: var(--text-muted);">+${p.models.length - 3} more</span>` : ''}
          </td>
          <td>
            ${p.base_url ? `
              <div style="display: flex; align-items: center; gap: 0.35rem;">
                <code style="font-size: 0.72rem; color: #38bdf8; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(p.base_url)}</code>
                <button class="btn-copy" onclick="window.FreeLLM.copyEndpoint(event, '${escapeHtml(p.base_url)}')">📋</button>
              </div>
            ` : '<span style="color: var(--text-muted); font-size: 0.75rem;">N/A</span>'}
          </td>
          <td>
            <div style="display: flex; gap: 0.2rem; flex-wrap: wrap; max-width: 160px;">
              ${(p.modalities || []).slice(0, 3).map(m => `<span class="tag" style="font-size: 0.65rem;">${escapeHtml(m)}</span>`).join('')}
            </div>
          </td>
          <td>
            <div style="display: flex; gap: 0.35rem;">
              <a href="${escapeHtml(p.signup_url || '#')}" target="_blank" rel="noopener" class="btn-header" style="font-size: 0.75rem; padding: 0.3rem 0.6rem;">
                Key →
              </a>
              <button class="btn-header" style="font-size: 0.75rem; padding: 0.3rem 0.6rem;" onclick="window.FreeLLM.openSnippet('${escapeHtml(p.id)}')">
                &lt;/&gt;
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Setup Event Listeners
  function setupEventListeners() {
    // Search input
    elements.searchInput.addEventListener('input', e => {
      state.searchQuery = e.target.value;
      renderProviders();
    });

    // View toggle buttons
    elements.btnViewCards.addEventListener('click', () => {
      state.activeView = 'cards';
      elements.btnViewCards.classList.add('active');
      elements.btnViewTable.classList.remove('active');
      renderProviders();
    });

    elements.btnViewTable.addEventListener('click', () => {
      state.activeView = 'table';
      elements.btnViewTable.classList.add('active');
      elements.btnViewCards.classList.remove('active');
      renderProviders();
    });

    // Tier Filter Pills
    elements.tierFilterGroup.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      elements.tierFilterGroup.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.tierFilter = btn.dataset.tier;
      renderProviders();
    });

    // Modality Filter Pills
    elements.modalityFilterGroup.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      elements.modalityFilterGroup.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.modalityFilter = btn.dataset.modality;
      renderProviders();
    });

    // Auth Filter Pills
    elements.authFilterGroup.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      elements.authFilterGroup.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.authFilter = btn.dataset.auth;
      renderProviders();
    });

    // Reset Filters
    function resetAllFilters() {
      state.searchQuery = '';
      state.tierFilter = 'all';
      state.modalityFilter = 'all';
      state.authFilter = 'all';
      elements.searchInput.value = '';

      elements.tierFilterGroup.querySelectorAll('.pill-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tier === 'all');
      });
      elements.modalityFilterGroup.querySelectorAll('.pill-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.modality === 'all');
      });
      elements.authFilterGroup.querySelectorAll('.pill-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.auth === 'all');
      });

      renderProviders();
    }

    elements.btnResetFilters.addEventListener('click', resetAllFilters);
    elements.btnEmptyReset.addEventListener('click', resetAllFilters);

    // Quick Guide Modal
    elements.btnQuickGuide.addEventListener('click', () => {
      elements.guideModal.classList.add('open');
    });
    elements.btnCloseGuide.addEventListener('click', () => {
      elements.guideModal.classList.remove('open');
    });
    elements.guideModal.addEventListener('click', e => {
      if (e.target === elements.guideModal) {
        elements.guideModal.classList.remove('open');
      }
    });

    // Code Snippet Modal
    elements.btnCloseSnippet.addEventListener('click', () => {
      elements.snippetModal.classList.remove('open');
    });
    elements.snippetModal.addEventListener('click', e => {
      if (e.target === elements.snippetModal) {
        elements.snippetModal.classList.remove('open');
      }
    });

    // Snippet Tab switching
    document.querySelectorAll('.snippet-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.snippet-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentSnippetLang = btn.dataset.lang;
        updateSnippetCode();
      });
    });

    // Copy snippet button
    elements.btnCopySnippet.addEventListener('click', () => {
      const code = elements.snippetCode.textContent;
      copyTextToClipboard(code, elements.btnCopySnippet, 'Copied Snippet!');
    });

    // Global keyboard shortcuts
    window.addEventListener('keydown', e => {
      if (e.key === '/' && document.activeElement !== elements.searchInput) {
        e.preventDefault();
        elements.searchInput.focus();
        elements.searchInput.select();
      } else if (e.key === 'Escape') {
        if (elements.snippetModal.classList.contains('open')) {
          elements.snippetModal.classList.remove('open');
        } else if (elements.guideModal.classList.contains('open')) {
          elements.guideModal.classList.remove('open');
        } else if (elements.searchInput.value) {
          resetAllFilters();
        }
      }
    });
  }

  // Open Snippet Drawer
  function openSnippet(providerId) {
    const provider = state.providers.find(p => p.id === providerId);
    if (!provider) return;

    state.currentSnippetProvider = provider;
    elements.snippetModalTitle.textContent = `${provider.name} Configuration`;
    elements.snippetProviderMeta.innerHTML = `
      Base URL: <code style="color: #38bdf8;">${escapeHtml(provider.base_url || 'N/A')}</code> &bull;
      Tier: <strong>${escapeHtml(provider.tier_label || 'Always Free')}</strong> &bull;
      Auth: ${escapeHtml(provider.verification_type || 'Registration')}
    `;

    updateSnippetCode();
    elements.snippetModal.classList.add('open');
  }

  // Generate Snippet Code
  function updateSnippetCode() {
    const p = state.currentSnippetProvider;
    if (!p) return;

    const baseUrl = p.base_url || 'https://api.example.com/v1';
    const sampleModel = (p.models && p.models.length > 0) ? p.models[0].id : 'default-model';
    const isNoKey = p.api_key_required === false;
    const keyPlaceholder = isNoKey ? 'none-required' : `YOUR_${p.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_KEY`;

    let code = '';

    if (state.currentSnippetLang === 'python') {
      code = `# FreeLLM Hub — ${p.name} Quick Start
from openai import OpenAI

# 1. Initialize OpenAI client with ${p.name}'s free-tier endpoint
client = OpenAI(
    base_url="${baseUrl}",
    api_key="${keyPlaceholder}",  # ${isNoKey ? 'Anonymous access available' : 'Get free key at ' + (p.signup_url || 'console')}
)

# 2. Run chat completion
response = client.chat.completions.create(
    model="${sampleModel}",
    messages=[
        {"role": "system", "content": "You are a helpful coding assistant."},
        {"role": "user", "content": "Hello! Explain quantum computing in one sentence."}
    ],
    temperature=0.7
)

print(response.choices[0].message.content)
`;
    } else if (state.currentSnippetLang === 'curl') {
      code = `# FreeLLM Hub — ${p.name} cURL Request
curl -X POST "${baseUrl}/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${keyPlaceholder}" \\
  -d '{
    "model": "${sampleModel}",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
`;
    } else if (state.currentSnippetLang === 'js') {
      code = `// FreeLLM Hub — ${p.name} (Node.js / OpenAI SDK)
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "${baseUrl}",
  apiKey: "${keyPlaceholder}"
});

async function main() {
  const completion = await openai.chat.completions.create({
    model: "${sampleModel}",
    messages: [{ role: "user", content: "Hello!" }],
  });

  console.log(completion.choices[0].message.content);
}

main();
`;
    }

    elements.snippetCode.textContent = code;
  }

  // Copy Helpers
  function copyTextToClipboard(text, triggerBtn, successText = 'Copied!') {
    navigator.clipboard.writeText(text).then(() => {
      const origHtml = triggerBtn.innerHTML;
      triggerBtn.innerHTML = `<span>✓</span> <span>${successText}</span>`;
      triggerBtn.style.color = '#34d399';
      setTimeout(() => {
        triggerBtn.innerHTML = origHtml;
        triggerBtn.style.color = '';
      }, 1800);
    }).catch(err => {
      console.error('Copy failed:', err);
    });
  }

  function copyEndpoint(e, url) {
    e.stopPropagation();
    const btn = e.currentTarget;
    copyTextToClipboard(url, btn, 'Copied URL');
  }

  function copyModelId(e, id) {
    e.stopPropagation();
    const target = e.currentTarget;
    navigator.clipboard.writeText(id).then(() => {
      const orig = target.innerHTML;
      target.innerHTML = `<code style="color: #34d399;">Copied ID: ${escapeHtml(id)}</code>`;
      setTimeout(() => {
        target.innerHTML = orig;
      }, 1500);
    });
  }

  // Escape HTML helper
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Expose global methods for inline triggers
  window.FreeLLM = {
    openSnippet,
    copyEndpoint,
    copyModelId
  };

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
