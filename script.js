/* ============================================================
   STUDENT PORTAL — script.js
   jQuery · Animations · Validation · CRUD · Theme Toggle
   ============================================================ */

/* ============================================================
   FIX #1 — LOADER: Register the hide logic OUTSIDE $(function(){})
   so it can catch the window 'load' event even if DOM-ready
   fires after the window has already loaded.
   Also added a hard 4-second fallback so the loader ALWAYS
   disappears even when a CDN resource blocks or fails.
   ============================================================ */
(function () {
  'use strict';

  /* Hard safety net — if window.load never fires (CDN blocked,
     offline, ad-blocker), dismiss the loader after 4 seconds. */
  var loaderDismissed = false;

  function dismissLoader() {
    if (loaderDismissed) return; // run only once
    loaderDismissed = true;
    var el = document.getElementById('loading-screen');
    if (el) {
      el.classList.add('hidden');
    }
    /* Hero animations — safe to call here because by this point
       either the DOM is ready (load event) or 4 seconds have
       passed (fallback), so all elements exist. */
    if (typeof $ !== 'undefined') {
      triggerHeroAnimations();
    }
  }

  /* Primary: window load event — fires after ALL resources load */
  window.addEventListener('load', function () {
    setTimeout(dismissLoader, 2200);
  });

  /* Fallback: hard 4-second cap — loader will NEVER stay forever */
  setTimeout(dismissLoader, 4000);

  /* Expose so jQuery-ready block can call it too if needed */
  window._dismissLoader = dismissLoader;
}());

/* ============================================================
   ALL JQUERY CODE — runs after DOM is ready
   ============================================================ */
$(function () {
  'use strict';

  /* ============================================================
     GLOBAL STATE
     ============================================================ */
  var students     = [];    // In-memory student array
  var editingIndex = null;  // Index of record being edited
  /* FIX #5 — typing effect: store timeout ID so we can cancel
     on teardown and prevent recursive pile-up. */
  var typingTimer  = null;


  /* ============================================================
     THEME TOGGLE — Dark / Light  (localStorage persisted)
     Applied immediately on DOM-ready — before paint — to avoid
     a flash of wrong theme.
     ============================================================ */
  var savedTheme = localStorage.getItem('eduportal-theme') || 'light';
  $('html').attr('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  $('#theme-toggle').on('click', function () {
    var current = $('html').attr('data-theme');
    var next    = current === 'light' ? 'dark' : 'light';
    $('html').attr('data-theme', next);
    localStorage.setItem('eduportal-theme', next);
    updateThemeIcon(next);
    showToast(next === 'dark' ? 'Dark mode enabled 🌙' : 'Light mode enabled ☀️', 'info');
  });

  function updateThemeIcon(theme) {
    if (theme === 'dark') {
      $('#theme-icon').removeClass('fa-moon').addClass('fa-sun');
    } else {
      $('#theme-icon').removeClass('fa-sun').addClass('fa-moon');
    }
  }

  /* ============================================================
     FIX #7 — CUSTOM CURSOR
     Only activate on non-touch devices to prevent ghost pointer
     issues on mobile / tablet.
     ============================================================ */
  var isTouchDevice = ('ontouchstart' in window) ||
                      (navigator.maxTouchPoints > 0);

  if (!isTouchDevice) {
    $(document).on('mousemove.cursor', function (e) {
      /* Add active class on first move so cursor becomes visible */
      $('#cursor, #cursor-dot').addClass('active');
      $('#cursor').css({ left: e.clientX, top: e.clientY });
      /* Small lag on dot for a trailing effect */
      setTimeout(function () {
        $('#cursor-dot').css({ left: e.clientX, top: e.clientY });
      }, 60);
    });

    $(document).on('mousedown.cursor', function () {
      $('#cursor').addClass('clicking');
    });
    $(document).on('mouseup.cursor', function () {
      $('#cursor').removeClass('clicking');
    });

    /* Hover state on interactive elements */
    $(document).on('mouseenter.cursor',
      'a, button, .course-card, .glass-card, input, select, textarea',
      function () { $('#cursor').addClass('hover'); }
    );
    $(document).on('mouseleave.cursor',
      'a, button, .course-card, .glass-card, input, select, textarea',
      function () { $('#cursor').removeClass('hover'); }
    );
  } else {
    /* Hide cursor elements entirely on touch devices */
    $('#cursor, #cursor-dot').hide();
  }

  /* ============================================================
     SCROLL PROGRESS BAR
     ============================================================ */
  $(window).on('scroll.progress', function () {
    var scrollTop = $(window).scrollTop();
    var docHeight = $(document).height() - $(window).height();
    var progress  = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    $('#scroll-progress-bar').css('width', progress + '%');
  });

  /* ============================================================
     NAVBAR — scroll behavior + active link highlighting
     ============================================================ */
  $(window).on('scroll.navbar', function () {
    if ($(window).scrollTop() > 60) {
      $('#mainNavbar').addClass('scrolled');
    } else {
      $('#mainNavbar').removeClass('scrolled');
    }
    updateActiveNavLink();
  });

  function updateActiveNavLink() {
    var scrollPos = $(window).scrollTop() + 100;
    $('.nav-link[href^="#"]').each(function () {
      var $link  = $(this);
      var href   = $link.attr('href');
      if (!href || href === '#') return;
      var $target = $(href);
      if (!$target.length) return;
      var top    = $target.offset().top;
      var bottom = top + $target.outerHeight();
      if (top <= scrollPos && bottom > scrollPos) {
        $('.nav-link').removeClass('active');
        $link.addClass('active');
      }
    });
  }

  /* Smooth scroll for anchor links
     FIX #4 — wrapped collapse call in try/catch so a missing
     Bootstrap JS doesn't break the entire scroll handler. */
  $(document).on('click', 'a[href^="#"]', function (e) {
    var href   = $(this).attr('href');
    if (!href || href === '#') return;
    var $target = $(href);
    if (!$target.length) return;
    e.preventDefault();
    $('html, body').animate({ scrollTop: $target.offset().top - 70 }, 700, 'swing');
    try {
      var collapseEl = document.getElementById('navbarContent');
      if (collapseEl && typeof bootstrap !== 'undefined') {
        var bsCollapse = bootstrap.Collapse.getInstance(collapseEl);
        if (bsCollapse) bsCollapse.hide();
      }
    } catch (err) { /* ignore if Bootstrap JS unavailable */ }
  });

  /* ============================================================
     BACK TO TOP BUTTON
     ============================================================ */
  $(window).on('scroll.btt', function () {
    if ($(window).scrollTop() > 400) {
      $('#backToTop').addClass('visible');
    } else {
      $('#backToTop').removeClass('visible');
    }
  });

  $('#backToTop').on('click', function () {
    $('html, body').animate({ scrollTop: 0 }, 700);
  });


  /* ============================================================
     HERO ENTRANCE ANIMATIONS (jQuery fadeIn / slideDown)
     FIX #6 — Elements should NOT be hidden via JS before the
     loader dismisses, because they flash invisible during load.
     Instead we hide them via CSS (opacity:0 / visibility:hidden)
     and only set display:none right before animating in.
     The safest approach: call .hide() synchronously right before
     each fadeIn chain — this is instant and avoids the flash.
     ============================================================ */
  function triggerHeroAnimations() {
    /* Guard — if jQuery isn't available yet, abort gracefully */
    if (typeof $ === 'undefined') return;

    $('#hero-badge').hide().fadeIn(600);
    $('#hero-heading').hide().delay(200).fadeIn(800);
    $('#hero-sub').hide().delay(500).fadeIn(800);
    $('#hero-btns').hide().delay(800).fadeIn(700);
    $('#hero-stats').hide().delay(1100).fadeIn(700);

    /* Hero illustration slides down */
    $('#hero-img-col').hide().delay(400).slideDown(900);

    /* Counters animate after hero is visible */
    setTimeout(animateHeroCounters, 1400);

    /* Typing effect starts shortly after heading appears */
    setTimeout(startTypingEffect, 600);
  }

  /* Expose to the IIFE loader block above */
  window.triggerHeroAnimations = triggerHeroAnimations;

  /* ============================================================
     TYPING EFFECT
     FIX #5 — Use a cancellable timer (typingTimer) so there is
     no pile-up of recursive setTimeout calls.
     ============================================================ */
  var typingWords = ['Academic', 'Professional', 'Creative', 'Bright'];
  var typingIndex = 0;
  var charIndex   = 0;
  var isDeleting  = false;
  var typingSpeed = 110;

  function startTypingEffect() {
    if (typingTimer) clearTimeout(typingTimer); // cancel any existing run
    typeWord();
  }

  /* Lightweight HTML escaper — avoids a jQuery DOM allocation */
  function escapeForDisplay(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function typeWord() {
    var current   = typingWords[typingIndex % typingWords.length];
    var displayed = isDeleting
      ? current.substring(0, charIndex - 1)
      : current.substring(0, charIndex + 1);

    if (isDeleting) { charIndex--; } else { charIndex++; }

    /* Append a blinking cursor span rather than relying on
       a CSS ::after that collides with dynamic text */
    $('#typed-text').html(
      escapeForDisplay(displayed) + '<span class="typed-cursor">|</span>'
    );

    var speed = isDeleting ? 60 : typingSpeed;

    if (!isDeleting && charIndex === current.length) {
      speed     = 1800;   // pause at full word
      isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
      isDeleting = false;
      typingIndex++;
      speed = 400;
    }

    typingTimer = setTimeout(typeWord, speed);
  }

  /* ============================================================
     COUNTER ANIMATIONS
     ============================================================ */
  function animateCounter($el) {
    var target = parseInt($el.data('target'), 10);
    if (isNaN(target)) return;
    $({ count: 0 }).animate({ count: target }, {
      duration: 2000,
      easing:   'swing',
      step:     function () { $el.text(Math.floor(this.count)); },
      complete: function () { $el.text(target); }
    });
  }

  function animateHeroCounters() {
    $('.hero-stats .stat-number').each(function () { animateCounter($(this)); });
  }

  /* Stats section counters — trigger once when scrolled into view */
  var statsAnimated = false;
  $(window).on('scroll.stats', function () {
    if (statsAnimated) return;
    var $section = $('#stats-section');
    if (!$section.length) return;
    if ($(window).scrollTop() + $(window).height() > $section.offset().top + 100) {
      statsAnimated = true;
      $('#stats-section .stats-num').each(function () { animateCounter($(this)); });
    }
  });

  /* ============================================================
     SCROLL REVEAL ANIMATIONS
     ============================================================ */
  function checkReveal() {
    var windowBottom = $(window).scrollTop() + $(window).height();
    $('.reveal-section').each(function () {
      if (!$(this).hasClass('revealed') &&
           windowBottom > $(this).offset().top + 80) {
        $(this).addClass('revealed');
      }
    });
  }

  $(window).on('scroll.reveal', checkReveal);
  checkReveal(); // run once on page load for above-fold sections

  /* ============================================================
     COURSE CARDS — Read More / Read Less (slideToggle)
     ============================================================ */
  $(document).on('click', '.read-more-btn', function () {
    var $btn     = $(this);
    var $moreDiv = $btn.closest('.course-card').find('.course-more');

    $moreDiv.slideToggle(350);
    $btn.toggleClass('open');

    if ($btn.hasClass('open')) {
      $btn.html('<i class="fas fa-chevron-up me-1"></i>Read Less');
    } else {
      $btn.html('<i class="fas fa-chevron-down me-1"></i>Read More');
    }
  });

  /* ============================================================
     RIPPLE BUTTON EFFECT
     ============================================================ */
  $(document).on('click', '.ripple-btn', function (e) {
    var $btn   = $(this);
    var offset = $btn.offset();
    var x      = e.pageX - offset.left;
    var y      = e.pageY - offset.top;
    var size   = Math.max($btn.outerWidth(), $btn.outerHeight());

    var $ripple = $('<span class="ripple"></span>').css({
      width:  size,
      height: size,
      left:   x - size / 2,
      top:    y - size / 2
    });
    $btn.append($ripple);
    setTimeout(function () { $ripple.remove(); }, 800);
  });

  /* ============================================================
     PROFILE PICTURE PREVIEW
     ============================================================ */
  $('#profilePic').on('change', function () {
    var file = this.files && this.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file.', 'error');
      return;
    }
    var reader = new FileReader();
    reader.onload = function (ev) {
      $('#avatarIcon').hide();
      $('#avatarImg').attr('src', ev.target.result).show();
    };
    reader.readAsDataURL(file);
  });

  /* ============================================================
     PASSWORD SHOW / HIDE TOGGLE
     ============================================================ */
  $(document).on('click', '.toggle-password', function () {
    var targetId = $(this).data('target');
    var $input   = $('#' + targetId);
    var $icon    = $(this).find('i');
    if ($input.attr('type') === 'password') {
      $input.attr('type', 'text');
      $icon.removeClass('fa-eye').addClass('fa-eye-slash');
    } else {
      $input.attr('type', 'password');
      $icon.removeClass('fa-eye-slash').addClass('fa-eye');
    }
  });


  /* ============================================================
     FORM VALIDATION — Real-time via keyup + blur
     ============================================================ */

  /* Helper — mark field valid */
  function setValid($field, $feedback, msg) {
    $field.removeClass('is-invalid-input').addClass('is-valid-input');
    $feedback.removeClass('error').addClass('success')
      .html('<i class="fas fa-check-circle me-1"></i>' + msg);
    $field.closest('.input-wrapper').find('.validation-icon')
      .html('<i class="fas fa-check-circle" style="color:#10b981"></i>');
  }

  /* Helper — mark field invalid */
  function setInvalid($field, $feedback, msg) {
    $field.removeClass('is-valid-input').addClass('is-invalid-input');
    $feedback.removeClass('success').addClass('error')
      .html('<i class="fas fa-times-circle me-1"></i>' + msg);
    $field.closest('.input-wrapper').find('.validation-icon')
      .html('<i class="fas fa-times-circle" style="color:#ef4444"></i>');
  }

  /* Full Name — alphabets only, min 3 chars */
  function validateName() {
    var val = $('#fullName').val().trim();
    var $fb = $('#fullName-feedback');
    if (!val)                           return setInvalid($('#fullName'), $fb, 'Full name is required.'),          false;
    if (!/^[A-Za-z\s]+$/.test(val))    return setInvalid($('#fullName'), $fb, 'Name must contain alphabets only.'), false;
    if (val.length < 3)                 return setInvalid($('#fullName'), $fb, 'Name must be at least 3 characters.'), false;
    setValid($('#fullName'), $fb, 'Looks good!');
    return true;
  }

  /* Email — standard format check */
  function validateEmail() {
    var val = $('#email').val().trim();
    var $fb = $('#email-feedback');
    if (!val)                                          return setInvalid($('#email'), $fb, 'Email address is required.'),       false;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val))      return setInvalid($('#email'), $fb, 'Please enter a valid email format.'), false;
    setValid($('#email'), $fb, 'Valid email address!');
    return true;
  }

  /* Phone — digits only, exactly 11 */
  function validatePhone() {
    var val = $('#phone').val().trim();
    var $fb = $('#phone-feedback');
    if (!val)                    return setInvalid($('#phone'), $fb, 'Phone number is required.'),                  false;
    if (!/^\d+$/.test(val))      return setInvalid($('#phone'), $fb, 'Phone number must contain digits only.'),     false;
    if (val.length !== 11)       return setInvalid($('#phone'), $fb, 'Phone number must be exactly 11 digits.'),    false;
    setValid($('#phone'), $fb, 'Valid phone number!');
    return true;
  }

  /* Date of Birth — must be in the past, age 10-100 */
  function validateDOB() {
    var val = $('#dob').val();
    var $fb = $('#dob-feedback');
    if (!val) return setInvalid($('#dob'), $fb, 'Date of birth is required.'), false;
    var dob = new Date(val);
    var now = new Date();
    var age = now.getFullYear() - dob.getFullYear();
    if (dob > now)          return setInvalid($('#dob'), $fb, 'Date of birth cannot be in the future.'), false;
    if (age < 10 || age > 100) return setInvalid($('#dob'), $fb, 'Please enter a valid date of birth.'), false;
    setValid($('#dob'), $fb, 'Age: ' + age + ' years');
    return true;
  }

  /* Password — min 8 chars + strength meter */
  function validatePassword() {
    var val = $('#password').val();
    var $fb = $('#password-feedback');

    /* Strength score */
    var strength = 0;
    if (val.length >= 8)           strength++;
    if (/[A-Z]/.test(val))         strength++;
    if (/[0-9]/.test(val))         strength++;
    if (/[^A-Za-z0-9]/.test(val))  strength++;

    var labels  = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    var classes = ['', 'strength-weak', 'strength-fair', 'strength-good', 'strength-strong'];
    var widths  = ['0%', '25%', '50%', '75%', '100%'];

    $('#strength-meter').removeClass('strength-weak strength-fair strength-good strength-strong');
    if (val.length > 0) {
      $('#strength-fill').css('width', widths[strength]);
      $('#strength-label').text(labels[strength] || 'Weak');
      $('#strength-meter').addClass(classes[strength]);
    } else {
      $('#strength-fill').css('width', '0%');
      $('#strength-label').text('Strength');
    }

    if (!val)          return setInvalid($('#password'), $fb, 'Password is required.'),                    false;
    if (val.length < 8) return setInvalid($('#password'), $fb, 'Password must be at least 8 characters.'), false;
    setValid($('#password'), $fb, 'Password looks strong!');
    return true;
  }

  /* Confirm Password — must match */
  function validateConfirmPassword() {
    var pass    = $('#password').val();
    var confirm = $('#confirmPassword').val();
    var $fb     = $('#confirmPassword-feedback');
    if (!confirm)          return setInvalid($('#confirmPassword'), $fb, 'Please confirm your password.'), false;
    if (confirm !== pass)  return setInvalid($('#confirmPassword'), $fb, 'Passwords do not match.'),       false;
    setValid($('#confirmPassword'), $fb, 'Passwords match!');
    return true;
  }

  /* Course dropdown */
  function validateCourse() {
    var val = $('#course').val();
    var $fb = $('#course-feedback');
    if (!val) return setInvalid($('#course'), $fb, 'Please select a course.'), false;
    setValid($('#course'), $fb, 'Course selected!');
    return true;
  }

  /* Gender radio */
  function validateGender() {
    var val = $('input[name="gender"]:checked').val();
    var $fb = $('#gender-feedback');
    if (!val) {
      $fb.removeClass('success').addClass('error')
         .html('<i class="fas fa-times-circle me-1"></i>Please select a gender.');
      return false;
    }
    $fb.removeClass('error').addClass('success')
       .html('<i class="fas fa-check-circle me-1"></i>Gender selected!');
    return true;
  }

  /* Bind real-time events */
  $('#fullName').on('keyup blur', validateName);
  $('#email').on('keyup blur', validateEmail);
  $('#phone').on('keyup blur', validatePhone);
  $('#dob').on('change blur', validateDOB);
  $('#password').on('keyup blur', validatePassword);
  $('#confirmPassword').on('keyup blur', validateConfirmPassword);
  /* Re-check confirm whenever password field changes */
  $('#password').on('keyup', function () {
    if ($('#confirmPassword').val().length > 0) validateConfirmPassword();
  });
  $('#course').on('change blur', validateCourse);
  $('input[name="gender"]').on('change', validateGender);


  /* ============================================================
     FORM SUBMISSION
     ============================================================ */
  $('#registrationForm').on('submit', function (e) {
    e.preventDefault(); // always prevent default

    /* Run all validators — collect all results before short-circuiting
       so every field shows its error at once, not one at a time. */
    var valid = [
      validateName(),
      validateEmail(),
      validatePhone(),
      validateDOB(),
      validatePassword(),
      validateConfirmPassword(),
      validateCourse(),
      validateGender()
    ].every(Boolean);

    if (!valid) {
      $('#submitBtn').addClass('shake');
      setTimeout(function () { $('#submitBtn').removeClass('shake'); }, 600);
      showToast('Please fix the errors before submitting.', 'error');
      /* Scroll to first invalid field so the user sees it */
      var $firstError = $('.is-invalid-input').first();
      if ($firstError.length) {
        $('html, body').animate(
          { scrollTop: $firstError.closest('.form-group-modern').offset().top - 120 }, 400
        );
      }
      return;
    }

    /* Show spinner, disable button */
    $('#submitBtn .btn-text').addClass('d-none');
    $('#submitBtn .btn-spinner').removeClass('d-none');
    $('#submitBtn').prop('disabled', true);

    /* Simulate async — 1.4 s processing delay */
    setTimeout(function () {
      var student = collectFormData();
      students.push(student);
      renderStudentTable();
      updateStudentCount();

      /* Restore button */
      $('#submitBtn .btn-spinner').addClass('d-none');
      $('#submitBtn .btn-text').removeClass('d-none');
      $('#submitBtn').prop('disabled', false);

      showSuccessPopup(student);
      resetRegistrationForm();
      showToast('Student registered successfully! 🎉', 'success');
    }, 1400);
  });

  /* Collect all form values into a plain object */
  function collectFormData() {
    var photo  = '';
    var imgSrc = $('#avatarImg').attr('src');
    if (imgSrc && imgSrc.startsWith('data:')) photo = imgSrc;

    return {
      name:   $('#fullName').val().trim(),
      email:  $('#email').val().trim(),
      phone:  $('#phone').val().trim(),
      dob:    $('#dob').val(),
      course: $('#course').val(),
      gender: $('input[name="gender"]:checked').val(),
      photo:  photo,
      date:   new Date().toLocaleDateString('en-PK', {
        day: '2-digit', month: 'short', year: 'numeric'
      })
    };
  }

  /* Reset form to blank state after submission */
  function resetRegistrationForm() {
    $('#registrationForm')[0].reset();
    $('.form-input-modern').removeClass('is-valid-input is-invalid-input');
    $('.feedback-msg').empty().removeClass('success error');
    $('.validation-icon').empty();
    $('#strength-fill').css('width', '0%');
    $('#strength-label').text('Strength');
    $('#strength-meter').removeClass(
      'strength-weak strength-fair strength-good strength-strong'
    );
    $('#avatarIcon').show();
    $('#avatarImg').hide().attr('src', '');
    $('#profilePic').val('');
  }

  /* ============================================================
     SUCCESS POPUP
     FIX #3 — Popup overlay: removed the broken CSS flex trick.
     Now the overlay is given display:flex explicitly via a
     wrapper class added by JS so centering always works.
     ============================================================ */
  function showSuccessPopup(student) {
    $('#successName').text(student.name);
    $('#successCourse').text(student.course);
    $('#successDetails').html(
      '<div style="display:flex;flex-direction:column;gap:6px;">' +
        '<span><i class="fas fa-envelope me-2" style="color:var(--primary)"></i>' +
          escapeHTML(student.email) + '</span>' +
        '<span><i class="fas fa-phone me-2" style="color:var(--primary)"></i>' +
          escapeHTML(student.phone) + '</span>' +
        '<span><i class="fas fa-calendar me-2" style="color:var(--primary)"></i>Registered: ' +
          escapeHTML(student.date) + '</span>' +
      '</div>'
    );
    /* Show as flex so the inner card is centred */
    $('#successOverlay').css('display', 'flex').hide().fadeIn(400);
  }

  $('#closeSuccessPopup').on('click', function () {
    $('#successOverlay').fadeOut(350, function () {
      var $records = $('#records');
      if ($records.length) {
        $('html, body').animate({ scrollTop: $records.offset().top - 70 }, 600);
      }
    });
  });

  /* Close on backdrop click */
  $('#successOverlay').on('click', function (e) {
    if ($(e.target).is('#successOverlay')) {
      $(this).fadeOut(350);
    }
  });


  /* ============================================================
     STUDENT RECORDS TABLE — Render / CRUD
     ============================================================ */

  /* FIX #8 — escapeHTML: replaced the jQuery-DOM approach with
     a pure-string method so it doesn't allocate jQuery objects
     inside tight loops. */
  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* Render the table from either the full students array
     or a pre-filtered subset. */
  function renderStudentTable(filteredData) {
    var data   = (filteredData !== undefined) ? filteredData : students;
    var $tbody = $('#studentsTableBody');

    if (students.length === 0) {
      $('#emptyState').show();
      $('#noResults').hide();
      $tbody.empty();
      return;
    }

    $('#emptyState').hide();

    if (data.length === 0) {
      $('#noResults').show();
      $tbody.empty();
      return;
    }

    $('#noResults').hide();
    $tbody.empty();

    /* Build all rows as one HTML string for a single DOM insertion
       — much faster than appending row by row. */
    var html = '';
    $.each(data, function (i, s) {
      var realIndex = students.indexOf(s);

      var photoHTML;
      if (s.photo) {
        photoHTML =
          '<img src="' + escapeHTML(s.photo) + '" alt="' + escapeHTML(s.name) +
          '" style="width:44px;height:44px;border-radius:50%;' +
          'object-fit:cover;border:2px solid var(--border-color);">';
      } else {
        var initials = escapeHTML(
          s.name.trim().split(/\s+/)
            .map(function (w) { return w.charAt(0); })
            .join('')
            .substring(0, 2)
            .toUpperCase()
        );
        photoHTML =
          '<div class="student-photo-cell" ' +
          'style="width:44px;height:44px;border-radius:50%;' +
          'background:linear-gradient(135deg,#6C63FF,#FF6584);' +
          'display:flex;align-items:center;justify-content:center;' +
          'font-size:1rem;font-weight:700;color:#fff;">' +
          initials + '</div>';
      }

      html +=
        '<tr data-index="' + realIndex + '">' +
          '<td>' + photoHTML + '</td>' +
          '<td><strong>' + escapeHTML(s.name)   + '</strong></td>' +
          '<td>' + escapeHTML(s.email)  + '</td>' +
          '<td>' + escapeHTML(s.phone)  + '</td>' +
          '<td><span class="course-badge-table">' + escapeHTML(s.course) + '</span></td>' +
          '<td>' + escapeHTML(s.gender) + '</td>' +
          '<td>' + escapeHTML(s.date)   + '</td>' +
          '<td>' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
              '<button class="btn btn-table-edit edit-btn" data-index="' + realIndex + '">' +
                '<i class="fas fa-edit me-1"></i>Edit' +
              '</button>' +
              '<button class="btn btn-table-delete delete-btn" data-index="' + realIndex + '">' +
                '<i class="fas fa-trash me-1"></i>Delete' +
              '</button>' +
            '</div>' +
          '</td>' +
        '</tr>';
    });

    $tbody.html(html);
  }

  /* Update the visible student count badge */
  function updateStudentCount() {
    $('#studentCount').text(students.length);
  }

  /* ── DELETE ─────────────────────────────────────────────────── */
  $(document).on('click', '.delete-btn', function () {
    var idx  = parseInt($(this).data('index'), 10);
    var name = (students[idx] && students[idx].name) ? students[idx].name : 'this student';
    var $row = $(this).closest('tr');

    if (!confirm('Are you sure you want to remove ' + name + '?')) return;

    $row.addClass('deleting');
    $row.fadeOut(400, function () {
      $(this).remove();
      students.splice(idx, 1);
      renderStudentTable();
      updateStudentCount();
      showToast(name + ' has been removed.', 'info');
    });
  });

  /* ── EDIT — open modal ──────────────────────────────────────── */
  $(document).on('click', '.edit-btn', function () {
    var idx = parseInt($(this).data('index'), 10);
    var s   = students[idx];
    if (!s) return;

    editingIndex = idx;
    $('#editIndex').val(idx);
    $('#editName').val(s.name);
    $('#editEmail').val(s.email);
    $('#editPhone').val(s.phone);
    $('#editCourse').val(s.course);

    /* Show as flex so it centres correctly — same fix as success popup */
    $('#editModalOverlay').css('display', 'flex').hide().fadeIn(350);
  });

  /* ── SAVE edited record ─────────────────────────────────────── */
  $('#editForm').on('submit', function (e) {
    e.preventDefault();
    var idx = parseInt($('#editIndex').val(), 10);

    if (students[idx]) {
      students[idx].name   = $('#editName').val().trim()  || students[idx].name;
      students[idx].email  = $('#editEmail').val().trim() || students[idx].email;
      students[idx].phone  = $('#editPhone').val().trim() || students[idx].phone;
      students[idx].course = $('#editCourse').val()       || students[idx].course;

      filterAndSearch(); // re-render with current filter applied
      $('#editModalOverlay').fadeOut(350);
      showToast('Student record updated successfully!', 'success');
    }
  });

  /* Close edit modal */
  $('#closeEditModal').on('click', function () {
    $('#editModalOverlay').fadeOut(350);
  });
  $('#editModalOverlay').on('click', function (e) {
    if ($(e.target).is('#editModalOverlay')) $(this).fadeOut(350);
  });

  /* ============================================================
     LIVE SEARCH & COURSE FILTER
     ============================================================ */
  function filterAndSearch() {
    var query  = $('#searchInput').val().toLowerCase().trim();
    var course = $('#filterCourse').val().toLowerCase();

    var filtered = students.filter(function (s) {
      var matchQuery = !query || (
        s.name.toLowerCase().indexOf(query)   !== -1 ||
        s.email.toLowerCase().indexOf(query)  !== -1 ||
        s.course.toLowerCase().indexOf(query) !== -1 ||
        s.phone.indexOf(query)                !== -1
      );
      var matchCourse = !course ||
        s.course.toLowerCase().indexOf(course) !== -1;

      return matchQuery && matchCourse;
    });

    renderStudentTable(filtered);

    if (query.length > 0) {
      $('#clearSearch').fadeIn(200);
    } else {
      $('#clearSearch').fadeOut(200);
    }
  }

  $('#searchInput').on('keyup input', filterAndSearch);
  $('#filterCourse').on('change', filterAndSearch);

  $('#clearSearch').on('click', function () {
    $('#searchInput').val('');
    filterAndSearch();
    $(this).fadeOut(200);
  });

  /* ============================================================
     TOAST NOTIFICATIONS
     ============================================================ */
  function showToast(message, type) {
    type = type || 'info';
    var icons = {
      success: 'fa-check-circle',
      error:   'fa-times-circle',
      info:    'fa-info-circle'
    };
    var iconClass = icons[type] || icons.info;

    var $toast = $(
      '<div class="toast-item toast-' + type + '" role="alert">' +
        '<i class="fas ' + iconClass + ' toast-icon"></i>' +
        '<span>' + escapeHTML(message) + '</span>' +
      '</div>'
    );

    $('#toast-container').append($toast);
    $toast.hide().fadeIn(350);

    setTimeout(function () {
      $toast.fadeOut(400, function () { $(this).remove(); });
    }, 3500);
  }

  /* ============================================================
     FOOTER YEAR
     ============================================================ */
  $('#footerYear').text(new Date().getFullYear());

  /* ============================================================
     KEYBOARD — Escape closes any open modal
     ============================================================ */
  $(document).on('keydown.modals', function (e) {
    if (e.key !== 'Escape') return;
    if ($('#successOverlay').is(':visible'))  $('#successOverlay').fadeOut(350);
    if ($('#editModalOverlay').is(':visible')) $('#editModalOverlay').fadeOut(350);
  });

  /* ============================================================
     ACCESSIBILITY — basic focus trap for open modals
     ============================================================ */
  $(document).on('keydown.trap', function (e) {
    if (e.key !== 'Tab') return;
    var $modal = $('.success-overlay:visible').first();
    if (!$modal.length) return;
    var $focusable = $modal
      .find('button, input, select, a[href], [tabindex]:not([tabindex="-1"])')
      .filter(':visible');
    if (!$focusable.length) return;
    var first = $focusable[0];
    var last  = $focusable[$focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  /* ============================================================
     SHAKE + DELETING ROW STYLES (injected once)
     ============================================================ */
  $('<style id="portal-dynamic-styles">').text(
    '@keyframes shake{' +
      '0%,100%{transform:translateX(0)}' +
      '15%{transform:translateX(-8px)}' +
      '30%{transform:translateX(8px)}' +
      '45%{transform:translateX(-6px)}' +
      '60%{transform:translateX(6px)}' +
      '75%{transform:translateX(-4px)}' +
      '90%{transform:translateX(4px)}' +
    '}' +
    '.shake{animation:shake 0.6s ease;}' +
    '.deleting td{background:rgba(239,68,68,0.08)!important;}'
  ).appendTo('head');

  /* ============================================================
     INITIAL TABLE RENDER + COUNTER
     ============================================================ */
  renderStudentTable();
  updateStudentCount();

}); // ── END $(function(){}) ─────────────────────────────────────
