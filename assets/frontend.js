jQuery(document).ready(function ($) {
  const restUrl = cfData.restUrl + 'counsellors';
  const $results = $('#counsellor-results');
  const $filters = {
    specialty: $('#specialty-filter'),
    client_group: $('#client_group-filter'),
    location: $('#location-filter'),
  };

  // Fetch counsellors with optional filters
  function fetchCounsellors(filters = {}) {
    $results.html('<p>Loading counsellors...</p>');

    // Remove empty filters
    Object.keys(filters).forEach((key) => {
      if (!filters[key]) delete filters[key];
    });

    $.get(restUrl, filters, function (response) {
      renderFilters(response.terms);
      renderCounsellors(response.counsellors);
    });
  }

  // Render dropdown filter options
  function renderFilters(terms) {
    Object.keys(terms).forEach((tax) => {
      const $select = $filters[tax];
      if ($select.children('option').length > 1) return; // Only populate once

      // Fetch all term names directly
      $.get(`${wpApiSettings.root}wp/v2/${tax}?per_page=100`, function (allTerms) {
        allTerms.forEach((term) => {
          if (terms[tax].includes(term.id)) {
            $select.append(`<option value="${term.id}">${term.name}</option>`);
          }
        });
      });
    });
  }

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
        <h3>${c.title}</h3>
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

  // When filters change, re-fetch data
  $('.filters select').on('change', function () {
    const filters = {
      specialty: $filters.specialty.val(),
      client_group: $filters.client_group.val(),
      location: $filters.location.val(),
    };
    fetchCounsellors(filters);
  });

  // Load initial data
  fetchCounsellors();
});
