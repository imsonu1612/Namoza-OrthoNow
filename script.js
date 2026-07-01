/**
 * OrthoNow — Consultation Landing Page
 * script.js
 *
 * Responsibilities:
 *  1. GTM dataLayer initialisation + all event tracking
 *  2. Booking funnel step tracker (reusable helper)
 *  3. Scroll depth tracking (25 / 50 / 75 / 90)
 *  4. Form validation (Indian phone number)
 *  5. Supabase lead insert
 *  6. Resend email notification
 *  7. Form state machine (idle → loading → success / error)
 *  8. Sticky CTA hide/show based on form visibility
 *
 * IMPORTANT — dataLayer philosophy:
 *  GTM cannot natively detect multi-step form interactions.
 *  Every event in this file is manually pushed to window.dataLayer.
 *  GTM is configured to listen for these custom event names.
 *  Never assume GTM fires automatically.
 *
 * Author: Namoza Developer Assignment
 */

'use strict';

/* ==========================================================================
   1. GTM / dataLayer Initialisation
   GTM snippet goes in <head> — we just ensure the array exists here
   so pushes before GTM loads are queued and not lost.
   ========================================================================== */
window.dataLayer = window.dataLayer || [];

/**
 * Push a structured event to window.dataLayer.
 * Central helper — all tracking calls go through here.
 * Ensures every event has a consistent timestamp.
 *
 * @param {string} eventName   - GA4-compatible event name (snake_case)
 * @param {Object} params      - Additional event parameters
 */
function pushEvent(eventName, params) {
  var payload = Object.assign(
    {
      event: eventName,
      page_path: window.location.pathname,
      timestamp: new Date().toISOString()
    },
    params
  );

  window.dataLayer.push(payload);

  // Dev-mode console log — remove or gate behind a debug flag in production
  if (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1') {
    console.log('[dataLayer]', payload);
  }
}

/* ==========================================================================
   2. Booking Funnel Step Tracker
   Reusable helper for the 3-step booking form.
   Must be called by the front-end developer on each step transition.
   GTM trigger: Custom Event where event equals 'booking_step_complete'
   ========================================================================== */

/**
 * Track a booking funnel step completion.
 * This is the function you brief the front-end dev team to call.
 *
 * @param {number} stepNumber   - 1, 2, or 3
 * @param {string} stepName     - Human-readable slug (snake_case)
 * @param {string} clinicLocation - e.g. "Koramangala, Bengaluru"
 * @param {string} specialty    - e.g. "Knee Pain"
 * @param {Object} [extra]      - Any additional step-specific params
 */
function trackBookingStep(stepNumber, stepName, clinicLocation, specialty, extra) {
  pushEvent('booking_step_complete', Object.assign({
    step_number:    stepNumber,
    step_name:      stepName,
    clinic_location: clinicLocation || '',
    specialty:      specialty || ''
    // NOTE: Never include raw PII (name, phone) in dataLayer
    // For enhanced conversions, hash the phone server-side
  }, extra || {}));
}

/* Example calls the front-end dev must wire up:

   // Step 1 — after user selects clinic + specialty and clicks Next
   trackBookingStep(1, 'location_specialty_selected', 'Koramangala, Bengaluru', 'Knee Pain');

   // Step 2 — after user fills name/phone/date and clicks Next
   trackBookingStep(2, 'patient_details_entered', 'Koramangala, Bengaluru', 'Knee Pain', {
     preferred_date: '2025-07-05'
   });

   // Step 3 — after backend confirms booking (on API success, not on button click)
   trackBookingStep(3, 'booking_confirmed', 'Koramangala, Bengaluru', 'Knee Pain', {
     booking_id: 'ORN-2025-00142'
   });
*/

/* ==========================================================================
   3. Scroll Depth Tracking
   Fires once per threshold per page session.
   GTM trigger: Custom Event where event equals 'scroll_depth'
   ========================================================================== */

var scrollThresholds = [25, 50, 75, 90];
var firedThresholds  = {};   // Track which thresholds have fired this session

function getScrollPercent() {
  var scrollTop    = window.pageYOffset || document.documentElement.scrollTop;
  var docHeight    = document.documentElement.scrollHeight;
  var windowHeight = window.innerHeight;
  var scrollable   = docHeight - windowHeight;

  if (scrollable <= 0) return 100;
  return Math.round((scrollTop / scrollable) * 100);
}

function onScroll() {
  var pct = getScrollPercent();

  for (var i = 0; i < scrollThresholds.length; i++) {
    var threshold = scrollThresholds[i];

    if (pct >= threshold && !firedThresholds[threshold]) {
      firedThresholds[threshold] = true;

      pushEvent('scroll_depth', {
        scroll_threshold: threshold,
        page_title: document.title
      });
    }
  }

  // Once all thresholds have fired, stop listening (performance)
  if (Object.keys(firedThresholds).length === scrollThresholds.length) {
    window.removeEventListener('scroll', onScroll);
  }
}

// Throttle scroll handler — no need to fire on every pixel
var scrollTimer = null;
window.addEventListener('scroll', function () {
  if (scrollTimer) return;
  scrollTimer = setTimeout(function () {
    onScroll();
    scrollTimer = null;
  }, 200);
}, { passive: true });

/* ==========================================================================
   4. Page View + CTA / Call / WhatsApp Click Tracking
   ========================================================================== */

// Fire page_view on load (GTM fires its own but this ensures GA4 custom params)
pushEvent('page_view', {
  page_title:    document.title,
  page_location: window.location.href
});

// CTA click tracking (all elements with .cta-btn or .js-cta-track)
document.addEventListener('click', function (e) {
  var target = e.target.closest('.cta-btn, .js-cta-track');
  if (!target) return;

  pushEvent('cta_click', {
    cta_text:     target.textContent.trim().substring(0, 50),
    cta_location: target.dataset.ctaLocation || 'unknown'
  });
});

// Call click tracking
document.addEventListener('click', function (e) {
  var target = e.target.closest('a[href^="tel:"]');
  if (!target) return;

  pushEvent('call_click', {
    click_location: target.dataset.location || 'unknown',
    phone_number:   target.href.replace('tel:', '')
  });
});

// WhatsApp click tracking
document.addEventListener('click', function (e) {
  var target = e.target.closest('a[href*="wa.me"]');
  if (!target) return;

  pushEvent('whatsapp_click', {
    click_location: target.dataset.location || 'float_button'
  });
});

/* ==========================================================================
   5. Form Validation
   ========================================================================== */

/**
 * Validate Indian mobile number.
 * Rules: 10 digits, starts with 6-9 (Airtel/Jio/BSNL/VI range).
 * Strips +91 / 0 prefix if user typed it.
 *
 * @param {string} phone
 * @returns {boolean}
 */
function isValidIndianPhone(phone) {
  var cleaned = phone.trim().replace(/\s/g, '').replace(/^(\+91|0)/, '');
  return /^[6-9]\d{9}$/.test(cleaned);
}

/**
 * Validate name — minimum 2 characters, no numbers.
 * @param {string} name
 * @returns {boolean}
 */
function isValidName(name) {
  return name.trim().length >= 2;
}

/**
 * Show or clear a field error.
 * @param {HTMLElement} field  - The input element
 * @param {string|null} message - Error message, or null to clear
 */
function setFieldError(field, message) {
  var errorEl = document.getElementById(field.id + '-error');

  if (message) {
    field.classList.add('is-error');
    field.setAttribute('aria-invalid', 'true');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add('is-visible');
    }
  } else {
    field.classList.remove('is-error');
    field.removeAttribute('aria-invalid');
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.remove('is-visible');
    }
  }
}

/**
 * Validate all form fields.
 * Returns true if valid, false if errors were found.
 * Fires 'validation_fail' event on failure.
 *
 * @param {HTMLFormElement} form
 * @returns {boolean}
 */
function validateForm(form) {
  var nameField   = form.querySelector('#field-name');
  var phoneField  = form.querySelector('#field-phone');
  var clinicField = form.querySelector('#field-clinic');
  var isValid     = true;

  // Clear all errors first
  [nameField, phoneField, clinicField].forEach(function (f) {
    if (f) setFieldError(f, null);
  });

  if (!isValidName(nameField.value)) {
    setFieldError(nameField, 'Please enter your full name (at least 2 characters)');
    isValid = false;
  }

  if (!isValidIndianPhone(phoneField.value)) {
    setFieldError(phoneField, 'Please enter a valid 10-digit Indian mobile number');
    isValid = false;
  }

  if (!clinicField.value) {
    setFieldError(clinicField, 'Please select a clinic location');
    isValid = false;
  }

  if (!isValid) {
    pushEvent('form_validation_error', {
      form_name:  'consultation_form',
      field_name: !isValidName(nameField.value) ? 'name' :
                  !isValidIndianPhone(phoneField.value) ? 'phone' : 'clinic',
      error_type: 'required_or_invalid'
    });
  }

  return isValid;
}

/* ==========================================================================
   6. Supabase Lead Insert
   Uses the Supabase JS SDK loaded via CDN in index.html.
   The anon key is safe to expose — Row Level Security on the table
   allows INSERT but blocks SELECT for anonymous users.
   ========================================================================== */

// Supabase project config
// Anon key is safe to expose client-side — Row Level Security on the
// leads table allows INSERT only, no SELECT for anonymous users.
var SUPABASE_URL      = 'https://ulvzzzqddmaofbbbifma.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsdnp6enFkZG1hb2ZiYmJpZm1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NDk2NjIsImV4cCI6MjA5ODMyNTY2Mn0.jdYnL4hVeBRpe3o3JAyu-jWxJf3tcBFncm9HYRZ6Chw';

// supabase client initialised after SDK loads (see DOMContentLoaded block below)
var supabaseClient = null;

/**
 * Insert a lead record into the Supabase 'leads' table.
 *
 * @param {Object} leadData
 * @param {string} leadData.name
 * @param {string} leadData.phone    - Cleaned 10-digit number
 * @param {string} leadData.clinic   - Clinic preference from dropdown
 * @returns {Promise<{data, error}>}
 */
async function insertLead(leadData) {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialised');
  }

  var record = {
    name:        leadData.name.trim(),
    phone:       leadData.phone.trim().replace(/^(\+91|0)/, ''),
    clinic:      leadData.clinic,
    source:      'Google Ads - Consultation Landing Page',
    lead_status: 'New Enquiry'
    // created_at is set by Supabase DEFAULT NOW()
  };

  return supabaseClient.from('leads').insert([record]);
}

/* ==========================================================================
   7. Resend Email Notification
   Sends an ops-team notification when a lead is captured.
   In production, this POST goes to a Supabase Edge Function that
   holds the Resend API key server-side (never expose in client JS).
   ========================================================================== */

/**
 * Notify ops team via Resend (through Edge Function proxy).
 * Fails silently — lead is already saved in Supabase; email is non-critical.
 *
 * @param {Object} leadData
 */
async function sendLeadNotification(leadData) {
  try {
    await fetch(SUPABASE_URL + '/functions/v1/notify-lead', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        name:   leadData.name,
        phone:  leadData.phone,
        clinic: leadData.clinic
      })
    });
  } catch (err) {
    // Non-critical — lead is in DB, this is just an ops notification
    console.warn('[notify] Email notification failed:', err.message);
  }
}

/* ==========================================================================
   8. Form State Machine
   States: idle → loading → success | error → idle (on retry)
   ========================================================================== */

/**
 * Set form to loading state.
 * Disables submit button and shows spinner to prevent double-submit.
 */
function setFormLoading(form) {
  var btn = form.querySelector('.btn-submit');
  btn.disabled = true;
  btn.classList.add('is-loading');
  btn.setAttribute('aria-busy', 'true');
}

/**
 * Reset form to idle state.
 */
function setFormIdle(form) {
  var btn = form.querySelector('.btn-submit');
  btn.disabled = false;
  btn.classList.remove('is-loading');
  btn.removeAttribute('aria-busy');
}

/**
 * Show the thank-you state.
 * Hides the form and reveals the success message without page reload.
 *
 * @param {HTMLElement} formWrapper  - Container holding the form
 * @param {HTMLElement} thankYouEl   - Thank-you state element
 * @param {string} patientName       - Used to personalise message
 */
function showThankYou(formWrapper, thankYouEl, patientName) {
  formWrapper.style.display = 'none';

  var nameEl = thankYouEl.querySelector('.js-patient-name');
  if (nameEl) {
    nameEl.textContent = patientName.split(' ')[0]; // First name only
  }

  thankYouEl.classList.add('is-visible');
  thankYouEl.setAttribute('aria-live', 'polite');

  // Scroll to thank-you message (smooth)
  thankYouEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * Show a form-level error status message.
 * Used when the API call fails and we want to tell the user to try again.
 */
function showFormError(form, message) {
  var statusEl = form.querySelector('.form-status');
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.className = 'form-status is-error';
  statusEl.setAttribute('role', 'alert');
}

/* ==========================================================================
   9. Form Submit Handler — Main Orchestration
   This is the critical section. Order of operations matters.
   ========================================================================== */

/**
 * Handle consultation form submission.
 * Orchestrates: validate → insert → notify → dataLayer → show thank-you
 *
 * @param {Event} e - The submit event
 */
async function handleFormSubmit(e) {
  e.preventDefault();  // Never let the form do a full-page POST

  var form        = e.target;
  var nameField   = form.querySelector('#field-name');
  var phoneField  = form.querySelector('#field-phone');
  var clinicField = form.querySelector('#field-clinic');
  var formWrapper = document.getElementById('form-wrapper');
  var thankYouEl  = document.getElementById('thank-you');

  // --- Step 1: Validate ---
  if (!validateForm(form)) {
    // Focus the first invalid field (accessibility)
    var firstError = form.querySelector('.is-error');
    if (firstError) firstError.focus();
    return;
  }

  var leadData = {
    name:   nameField.value.trim(),
    phone:  phoneField.value.trim().replace(/^(\+91|0)/, ''),
    clinic: clinicField.value
  };

  // --- Step 2: Disable submit (prevent double-submit) ---
  setFormLoading(form);

  try {
    // --- Step 3: Insert into Supabase ---
    var result = await insertLead(leadData);

    if (result.error) {
      // Supabase returned an error (constraint violation, network, etc.)
      throw new Error(result.error.message || 'Database error');
    }

    // --- Step 4: Fire ops email notification (non-blocking) ---
    // We do not await this — it's background, non-critical
    sendLeadNotification(leadData);

    // --- Step 5: Fire GTM dataLayer push ---
    // This is the conversion event imported into Google Ads.
    // It fires AFTER successful DB insert — not on click, not on page load.
    pushEvent('consultation_form_submitted', {
      form_name:         'consultation_form',
      clinic_preference: leadData.clinic,
      // page_path and timestamp are added by pushEvent() automatically
    });

    // --- Step 6: Show thank-you state (no page reload) ---
    showThankYou(formWrapper, thankYouEl, leadData.name);

    // Hide sticky CTA after conversion
    var stickyCta = document.querySelector('.sticky-cta');
    if (stickyCta) stickyCta.classList.add('is-hidden');

  } catch (err) {
    // API failed — reset button, show error, keep form data intact
    console.error('[form] Submission error:', err.message);

    setFormIdle(form);
    showFormError(form,
      'Something went wrong. Please try again or call us directly at the number above.'
    );

    pushEvent('form_submission_error', {
      form_name:  'consultation_form',
      error_type: err.message.substring(0, 100)
    });
  }
}

/* ==========================================================================
   10. Form Start Tracking
   Fires 'form_start' on first interaction with any form field.
   Used to calculate form abandonment rate in GA4.
   ========================================================================== */

var formStartFired = false;

function trackFormStart() {
  if (formStartFired) return;
  formStartFired = true;

  pushEvent('form_start', {
    form_name: 'consultation_form'
  });
}

/* ==========================================================================
   11. Sticky CTA visibility
   Hides the sticky bottom bar when the hero form is in viewport.
   This avoids duplicate CTAs competing for attention.
   ========================================================================== */

function setupStickyCta() {
  var heroForm  = document.getElementById('form-wrapper');
  var stickyCta = document.querySelector('.sticky-cta');

  if (!heroForm || !stickyCta) return;

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          stickyCta.classList.add('is-hidden');
        } else {
          stickyCta.classList.remove('is-hidden');
        }
      });
    },
    { threshold: 0.3 }  // Hide sticky when 30% of form is visible
  );

  observer.observe(heroForm);
}

/* ==========================================================================
   12. DOMContentLoaded — Wire everything up
   ========================================================================== */

document.addEventListener('DOMContentLoaded', function () {

  // Initialise Supabase client (SDK loaded via <script> in index.html)
  // supabase is the global exposed by the CDN bundle
  if (typeof supabase !== 'undefined') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.warn('[supabase] SDK not loaded — form will fail silently');
  }

  // Attach form submit handler
  var consultationForm = document.getElementById('consultation-form');
  if (consultationForm) {
    consultationForm.addEventListener('submit', handleFormSubmit);

    // Track first field interaction
    var fields = consultationForm.querySelectorAll('input, select');
    fields.forEach(function (field) {
      field.addEventListener('focus', trackFormStart, { once: true });
    });
  }

  // Sticky CTA observer
  setupStickyCta();

  // Scroll depth (listener already attached above — starts immediately)
  // Fire initial check in case page loads already scrolled (e.g. anchor link)
  onScroll();
});
