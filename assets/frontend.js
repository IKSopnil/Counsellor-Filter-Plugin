jQuery(document).ready(function ($) {
  const restUrl = cfData.restUrl + 'counsellors';
  const $results = $('#counsellor-results');
  const $filters = {
    specialty: $('#specialty-filter'),
    client_group: $('#client_group-filter'),
    location: $('#location-filter'),
  };

  /* ========= Fetch and Render Counsellors ========= */
  function fetchCounsellors(filters = {}) {
    $results.html('<p>Loading counsellors...</p>');

    // Remove empty filters
    Object.keys(filters).forEach((key) => {
      if (!filters[key]) delete filters[key];
    });

    $.get(restUrl, filters, function (response) {
      renderCounsellors(response.counsellors);
    }).fail(function () {
      $results.html('<p>Error loading counsellors. Please try again later.</p>');
    });
  }

  /* ========= Render Dropdown Filters (show all terms) ========= */
/* ========= Render Dropdown Filters (robust) ========= */
function renderFilters() {
  const taxList = Object.keys($filters); // ['specialty','client_group','location']

  // Step 1: ask our plugin endpoint for term IDs collected from counsellor posts
  $.get(cfData.restUrl + 'counsellors')
    .done(function (resp) {
      // resp.terms should be { specialty: [ids...], client_group: [...], location: [...] }
      taxList.forEach((tax) => {
        const $select = $filters[tax];
        $select.find('option:not(:first)').remove(); // clear previous options except "All"

        const ids = Array.isArray(resp.terms && resp.terms[tax]) ? resp.terms[tax] : [];

        // Helper to append terms to select
        const appendTerms = (terms) => {
          terms.forEach((term) => {
            $select.append(`<option value="${term.id}">${term.name}</option>`);
          });
        };

        // If we have IDs from the plugin REST response, fetch those term details (faster & accurate)
        if (ids.length) {
          // WP REST accepts include=1,2,3 and per_page up to 100
          const includeParam = ids.join(',');
          $.get(`${wpApiSettings.root}wp/v2/${tax}?include=${includeParam}&per_page=100&hide_empty=false`)
            .done(function (terms) {
              if (Array.isArray(terms) && terms.length) {
                appendTerms(terms);
              } else {
                // If that returned empty, fallback to fetching all terms
                console.warn(`No terms returned for include(${includeParam}). Falling back to all terms for ${tax}.`);
                fetchAllTermsAndAppend(tax, appendTerms);
              }
            })
            .fail(function (jqXHR, textStatus, err) {
              console.error(`Error fetching terms by include for ${tax}:`, textStatus, err);
              // fallback
              fetchAllTermsAndAppend(tax, appendTerms);
            });
        } else {
          // No term IDs from plugin endpoint: fetch all terms (including empty terms)
          fetchAllTermsAndAppend(tax, appendTerms);
        }
      });
    })
    .fail(function () {
      console.error('Could not reach plugin REST endpoint; falling back to fetching all terms directly.');
      // Fall back: fetch all terms for each taxonomy
      taxList.forEach((tax) => {
        const $select = $filters[tax];
        $select.find('option:not(:first)').remove();
        fetchAllTermsAndAppend(tax, (terms) => {
          terms.forEach((term) => {
            $select.append(`<option value="${term.id}">${term.name}</option>`);
          });
        });
      });
    });

  // Helper: fetch all terms for a taxonomy, handling pagination
  function fetchAllTermsAndAppend(tax, appendCallback, page = 1, accum = []) {
    $.get(`${wpApiSettings.root}wp/v2/${tax}?per_page=100&page=${page}&hide_empty=false`)
      .done(function (terms, textStatus, xhr) {
        accum = accum.concat(terms || []);
        const totalPages = parseInt(xhr.getResponseHeader('X-WP-TotalPages') || '1', 10);
        if (page < totalPages) {
          // fetch next page
          fetchAllTermsAndAppend(tax, appendCallback, page + 1, accum);
        } else {
          appendCallback(accum);
        }
      })
      .fail(function (jqXHR, textStatus, err) {
        console.error(`Failed to fetch terms for ${tax} (page ${page}):`, textStatus, err);
      });
  }
}


  /* ========= Render Counsellor Cards ========= */
  function renderCounsellors(counsellors) {
    $results.empty();

    if (!counsellors.length) {
      $results.html('<p>No counsellors found.</p>');
      return;
    }

    counsellors.forEach((c) => {
      const html = `
        <div class="counsellor-card">
          ${c.thumbnail ? `<img src="${c.thumbnail}" alt="${c.title}">` : ''}
          <h3>${c.title} <sub style="font-size: 0.7em; color: #555;">${c.degree || ''}</sub></h3>
          <p>${c.content}</p>
          <p><strong>Specializes In:</strong> ${c.specialties.join(', ') || '—'}</p>
          <p><strong>Works With:</strong> ${c.client_groups.join(', ') || '—'}</p>
          <p><strong>Location:</strong> ${c.locations.join(', ') || '—'}</p>
          <div class="counsellor-actions">
            <a href="${c.permalink}" class="btn secondary">View Full Bio</a>
            <a href="mailto:${c.email}" class="btn">Book a Free Chat</a>
          </div>
        </div>
      `;
      $results.append(html);
    });
  }

  /* ========= Filter Change Events ========= */
  $('.filters select').on('change', function () {
    const filters = {
      specialty: $filters.specialty.val(),
      client_group: $filters.client_group.val(),
      location: $filters.location.val(),
    };
    fetchCounsellors(filters);
  });

  /* ========= Clear Filters ========= */
  $('#cf-clear-filters').on('click', function () {
    $filters.specialty.val('');
    $filters.client_group.val('');
    $filters.location.val('');
    fetchCounsellors({});
  });

  /* ========= Initialize Page ========= */
  renderFilters();
  fetchCounsellors();

  /* ========= Modal Logic ========= */
  const $modal = $(`
    <div id="cf-modal" class="cf-modal" style="display:none;">
      <div class="cf-modal-content">
        <button class="cf-modal-close">&times;</button>
        <div class="cf-modal-body">Loading...</div>
      </div>
    </div>
  `).hide();

  $('body').append($modal);

  // Open modal when clicking "View Full Bio"
  $(document).on('click', '.counsellor-card .btn.secondary', function (e) {
    e.preventDefault();
    const url = $(this).attr('href');
    const postSlug = url.split('/').filter(Boolean).pop();

    $('.cf-modal-body').html('<p>Loading...</p>');
    $modal.fadeIn(200);

    // Fetch full post content via REST API (by slug)
    $.get(`${wpApiSettings.root}wp/v2/counsellor?slug=${postSlug}`, function (data) {
      if (data.length) {
        const post = data[0];
        $('.cf-modal-body').html(`
          <h2>${post.title.rendered}</h2>
          <div class="cf-bio-content">${post.content.rendered}</div>
        `);
      } else {
        $('.cf-modal-body').html('<p>Unable to load counsellor details.</p>');
      }
    });
  });

  // Close modal
  $(document).on('click', '.cf-modal, .cf-modal-close', function (e) {
    if (e.target !== this) return;
    $modal.fadeOut(200);
  });
});
