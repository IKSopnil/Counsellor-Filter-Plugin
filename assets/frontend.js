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

  // Render counsellor cards
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

  // When filters change, re-fetch data
  $('.filters select').on('change', function () {
    const filters = {
      specialty: $filters.specialty.val(),
      client_group: $filters.client_group.val(),
      location: $filters.location.val(),
    };
    fetchCounsellors(filters);
  });


// When filters change, re-fetch data
$('.filters select').on('change', function () {
  const filters = {
    specialty: $filters.specialty.val(),
    client_group: $filters.client_group.val(),
    location: $filters.location.val(),
  };
  fetchCounsellors(filters);
});

// Clear Filters button
$('#cf-clear-filters').on('click', function() {
  $filters.specialty.val('');
  $filters.client_group.val('');
  $filters.location.val('');
  fetchCounsellors({});
});
  // Load initial data
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

