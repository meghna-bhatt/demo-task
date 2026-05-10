(function () {
  "use strict";
// Gets the JSON data created in liquid
  function readFinderConfig(sectionId) {
    var el = document.getElementById("dynamic-finder-data-" + sectionId);
    if (!el || el.tagName !== "SCRIPT") return null;
    try {
      return JSON.parse(el.textContent.trim());
    } catch (e) {
      console.warn("DynamicFinder: invalid JSON for section", sectionId, e);
      return null;
    }
  }
  //core function-mounts the finder- loads products, applies filters, renders UI, handles cart actions
  function mountFinder(config) {
    if (!config || !config.sectionId) return;

    var sectionId = String(config.sectionId);
    var data = Array.isArray(config.products) ? config.products : [];
    var finderLabels = config.labels || {};
    var finderCardMetaFields = Array.isArray(config.cardMetaFields) ? config.cardMetaFields : [];
    var filterDefs = Array.isArray(config.filters) ? config.filters : [];
    var defaultEmptyMessage =
      typeof config.emptyDefaultMessage === "string"
        ? config.emptyDefaultMessage
        : "Select filters and click Apply";
    var noMatchMessage =
      typeof config.noMatchMessage === "string" ? config.noMatchMessage : "No match found";

  //helper function- gets metafield values from products
    function getMeta(p, key) {
      if (!p || !p.metafields) return "";
      var val = p.metafields[key];
      if (val === false) return "false";
      if (val === true) return "true";
      return val ? String(val).trim() : "";
    }
  //List metafields helper function- used for filtering
    function getMetaValues(p, key) {
      return getMeta(p, key)
        .split(/[;,]/)
        .map(function (value) {
          return value.trim();
        })
        .filter(Boolean);
    }

    //apply filter button logic
    function applyFilters() {
      var activeFilters = [];
      filterDefs.forEach(function (f) {
        var sel = document.getElementById("filter-" + sectionId + "-" + f.blockId);//Collect selected dropdown values
        var v = sel ? sel.value || "" : "";
        if (v) activeFilters.push({ key: f.key, value: v }); // Build filter list
      });

      var normalize = function (v) { // cleans and standardizes values so comparisons always work correctly- case-insensitive comparison
        return String(v != null ? v : "").trim().toLowerCase();
      };
      //Keep only products that match all selected filters
      var filtered = data.filter(function (p) {
        return activeFilters.every(function (filter) {
          return getMetaValues(p, filter.key).map(normalize).includes(normalize(filter.value));
        });
      });

      render(filtered, false);
      updateCount(filtered.length);
    }

    //clear button logic- Reset all dropdown filters, clear results, and restore empty state
    function clearFilters() {
      filterDefs.forEach(function (f) {
        var el = document.getElementById("filter-" + sectionId + "-" + f.blockId);
        if (el) el.value = "";
      });

      render([], true);// show empty state & remove all products
      updateCount(0); // reset result count to 0
    }

    //Shows how many products matched the filters, or hides the message if none
    function updateCount(count) {
      var resultCountEl = document.getElementById("result-count-" + sectionId);
      if (!resultCountEl) return;

      var message = "";
      if (count > 0) {
        message = count === 1 ? "1 product found" : count + " products found";
      }
      resultCountEl.innerText = message;
      resultCountEl.classList.toggle("is-visible", Boolean(message));
    }

    //It returns the container where product results are shown
    function resultsScope() {
      return document.getElementById("results-" + sectionId);
    }

    //It converts unsafe text into safe HTML so it cannot break page or inject code
    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    //Helps to read a variant option value from a shopify product variant
    function variantOpt(variant, position) {
      var key = "option" + position;
      var raw = variant && variant[key];
      return raw == null ? "" : String(raw).trim();
    }
    //Does changing this option actually change something meaningful likeprice or image?- It decides whether a product option should behave like a real interactive selector or just a static label
    //Return true if changing the option changes Price OR Image
    function optionIsInteractive(position, variants) {
      for (var i = 0; i < variants.length; i++) {
        for (var j = i + 1; j < variants.length; j++) {
          var a = variants[i];
          var b = variants[j];
          var sameOther = true;
          for (var p = 1; p <= 3; p++) {
            if (p === position) continue;
            if (variantOpt(a, p) !== variantOpt(b, p)) {
              sameOther = false;
              break;
            }
          }
          if (!sameOther) continue;
          if (variantOpt(a, position) === variantOpt(b, position)) continue;
          if (Number(a.price_cents) !== Number(b.price_cents)) return true;
          if (String(a.image || "") !== String(b.image || "")) return true;
        }
      }
      return false;
    }
    //Given the user’s current option selections, which product variant should the storefront display?
    function pickVariantForSelections(product, interactivePositions, selections) {
      var variants = product.variants || [];
      var matched = variants.filter(function (v) {
        return interactivePositions.every(function (pos) {
          var wanted = selections[pos];
          if (!wanted) return true;
          return variantOpt(v, pos) === wanted;
        });
      });
      var avail = matched.find(function (v) {
        return v.available;
      });
      return (
        avail ||
        matched[0] ||
        variants.find(function (v) {
          return v.available;
        }) ||
        variants[0]
      );
    }
    //Given current selections, what values are possible for this option -price changes or image changes
    function valuesForInteractiveOption(product, interactivePositions, pos, selections) {
      var variants = product.variants || [];
      var others = interactivePositions.filter(function (p) {
        return p !== pos;
      });
      var base = variants.filter(function (v) {
        return others.every(function (p) {
          var wanted = selections[p];
          if (!wanted) return true;
          return variantOpt(v, p) === wanted;
        });
      });
      var set = new Set();
      base.forEach(function (v) {
        var val = variantOpt(v, pos);
        if (val) set.add(val);
      });
      return Array.from(set).sort();
    }
    //It just creates a unique ID for each card
    function cardKeyForIndex(index) {
      return sectionId + "-dfc-" + index;
    }
    //Takes selected product variant, Loops through its options (Color, Size) & Skips dropdown options, Builds HTML of varients
    function variantInfoHtmlForCard(product, chosen, interactivePositions) {
      if (!chosen) return "";
      var interactiveSet = new Set(interactivePositions || []);
      var optionNames = product.option_names || [];
      var oc = optionNames.length;
      var html = "";
      if (oc > 0) {
        for (var pos = 1; pos <= oc; pos++) {
          if (interactiveSet.has(pos)) continue;
          var optMeta = optionNames.find(function (o) {
            return o.position === pos;
          });
          var nm = optMeta && optMeta.name ? optMeta.name : "Option";
          var val = variantOpt(chosen, pos);
          if (!val) continue;
          html +=
            '<div class="variant-info-row">' +
            '<span class="variant-info-label">' +
            escapeHtml(nm) +
            "</span>" +
            '<span class="variant-info-value">' +
            escapeHtml(val) +
            "</span>" +
            "</div>";
        }
      } else if ((product.variants || []).length > 1) {
        html +=
          '<div class="variant-info-row">' +
          '<span class="variant-info-label">Variant</span>' +
          '<span class="variant-info-value">' +
          escapeHtml(chosen.title || "") +
          "</span>" +
          "</div>";
      }
      return html;
    }
    //checks if a metafield value is meaningful enough to show on the product card- it filters out empty, null, undefined, or meaningless values so only useful info is displayed on product cards
    function metaLineShouldShow(displayRaw) {
      if (displayRaw === undefined || displayRaw === null) return false;
      var s = String(displayRaw).trim();
      if (!s) return false;
      var lower = s.toLowerCase();
      if (lower === "undefined" || lower === "null") return false;
      return true;
    }
    //formats Shopify metafield values into safe display text for product cards. It handles boolean values, trims whitespace, and escapes HTML to ensure clean and secure display of metafield information on product cards
    function formatMetaLineDisplay(raw) {
      if (raw === false || raw === true) return escapeHtml(String(raw));
      var s = raw == null ? "" : String(raw).trim();
      return escapeHtml(s);
    }
    //showing metafields -extra product info on a product card
    function renderProductMetaHtml(product) {
      if (!finderCardMetaFields.length) return "";
      var rows = "";
      finderCardMetaFields.forEach(function (row) {
        var raw = getMeta(product, row.key);
        if (!metaLineShouldShow(raw)) return;
        rows +=
          "<p><b>" +
          escapeHtml(row.label || row.key) +
          ":</b> " +
          formatMetaLineDisplay(raw) +
          "</p>";
      });
      return rows ? '<div class="meta">' + rows + "</div>" : "";
    }
    //building one full product card
    function renderDynamicCard(product, cardKey) {
      var controlsHtml =
        '<div class="finder-variant-ui finder-variant-slot" data-card="' +
        cardKey +
        '" data-variant-root="' +
        cardKey +
        '" data-current-variant-id=""></div>';

      var productUrl = product.url || "/products/" + (product.handle || "");
      var safeTitle = escapeHtml(product.title);

      return (
        '<div class="card" data-dynamic-card="' +
        cardKey +
        '">' +
        '<a class="card-image-link" href="' +
        productUrl +
        '" aria-label="' +
        safeTitle +
        '">' +
        '<img id="card-image-' +
        cardKey +
        '" src="' +
        product.image +
        '" alt="' +
        safeTitle +
        '" loading="lazy" decoding="async" width="600" height="300" />' +
        '</a>' +
        '<div class="finder-card-main">' +
        '<div class="finder-card-lead">' +
        '<h3><a class="card-title-link" href="' +
        productUrl +
        '">' +
        safeTitle +
        "</a></h3>" +
        '<p id="card-price-' +
        cardKey +
        '">' +
        product.price +
        "</p>" +
        "</div>" +
        '<div class="finder-card-main-detail">' +
        renderProductMetaHtml(product) +
        controlsHtml +
        "</div>" +
        "</div>" +
        '<div class="actions">' +
        '<button type="button" class="btn" title="' +
        escapeHtml(finderLabels.addToCart || "Add to Cart") +
        '" data-dynamic-add-cart data-card-key="' +
        cardKey +
        '">' +
        escapeHtml(finderLabels.addToCart || "Add to Cart") +
        '</button>' +
        '<button type="button" class="btn buy" title="' +
        escapeHtml(finderLabels.buyNow || "Buy Now") +
        '" data-dynamic-buy-now data-card-key="' +
        cardKey +
        '">' +
        escapeHtml(finderLabels.buyNow || "Buy Now") +
        "</button>" +
        "</div>" +
        "</div>"
      );
    }
    //How should this product show variants
    function initDynamicVariantCard(cardKey, product) {
      var scope = resultsScope();
      if (!scope) return;

      var slot = scope.querySelector('.finder-variant-slot[data-card="' + cardKey + '"]');
      if (!slot) return;

      var variants = Array.isArray(product.variants) ? product.variants : [];
      if (variants.length === 0) return;

      var optionNames = Array.isArray(product.option_names) ? product.option_names : [];
      var optionCount = optionNames.length;

      function mountStaticSummary(pick) {
        if (!pick) return;
        var infoHtml = variantInfoHtmlForCard(product, pick, []);
        slot.dataset.currentVariantId = String(pick.id);
        slot.innerHTML =
          '<div class="variant-info" id="variant-info-' +
          cardKey +
          '"' +
          (infoHtml ? "" : ' style="display:none"') +
          ">" +
          infoHtml +
          "</div>";
      }

      if (!optionCount) {
        mountStaticSummary(
          variants.find(function (v) {
            return String(v.id) === String(product.id) && v.available;
          }) ||
            variants.find(function (v) {
              return v.available;
            }) ||
            variants[0]
        );
        return;
      }

      var interactive = [];
      for (var pos = 1; pos <= optionCount; pos++) {
        if (optionIsInteractive(pos, variants)) interactive.push(pos);
      }

      if (interactive.length === 0) {
        mountStaticSummary(
          variants.find(function (v) {
            return String(v.id) === String(product.id);
          }) ||
            variants.find(function (v) {
              return v.available;
            }) ||
            variants[0]
        );
        return;
      }

      var baseVariant =
        variants.find(function (v) {
          return String(v.id) === String(product.id);
        }) || variants[0];

      var selections = {};
      interactive.forEach(function (pos) {
        selections[pos] = variantOpt(baseVariant, pos);
      });

      slot.innerHTML = buildInteractiveVariantMarkup(cardKey, product, interactive, selections);
      bindInteractiveVariantCard(cardKey, product, interactive, selections, slot);
    }
    //Interactive variant dropdown UI based on available product options and current selections
    function buildInteractiveVariantMarkup(cardKey, product, interactivePositions, selections) {
      var optionNames = product.option_names || [];
      var nameByPos = {};
      optionNames.forEach(function (o) {
        nameByPos[o.position] = o.name;
      });

      var selectsHtml = "";
      interactivePositions.forEach(function (pos) {
        var label = nameByPos[pos] || "Option";
        var values = valuesForInteractiveOption(product, interactivePositions, pos, selections);
        var opts = values
          .map(function (val) {
            var sel = selections[pos] === val ? "selected" : "";
            return '<option value="' + escapeHtml(val) + '" ' + sel + ">" + escapeHtml(val) + "</option>";
          })
          .join("");
        selectsHtml +=
          '<div class="variant-picker">' +
          '<label for="finder-opt-' +
          cardKey +
          "-" +
          pos +
          '">' +
          escapeHtml(label) +
          "</label>" +
          '<select id="finder-opt-' +
          cardKey +
          "-" +
          pos +
          '" class="variant-select finder-variant-opt" data-opt-pos="' +
          pos +
          '">' +
          opts +
          "</select>" +
          "</div>";
      });

      return (
        '<div class="variant-info" id="variant-info-' +
        cardKey +
        '" style="display:none"></div>' +
        '<div class="variant-interactive">' +
        selectsHtml +
        "</div>"
      );
    }
    //Connects dropdowns to live product updates- when user changes a dropdown, it updates the displayed variant, price, image, and available options accordingly 
    function bindInteractiveVariantCard(cardKey, product, interactivePositions, selections, root) {
      if (!root) return;

      function sync() {
        var chosen = pickVariantForSelections(product, interactivePositions, selections);
        if (!chosen) return;

        root.dataset.currentVariantId = String(chosen.id);

        var imageEl = document.getElementById("card-image-" + cardKey);
        if (imageEl && chosen.image) imageEl.src = chosen.image;

        var priceEl = document.getElementById("card-price-" + cardKey);
        if (priceEl && chosen.price) priceEl.textContent = chosen.price;

        var infoEl = document.getElementById("variant-info-" + cardKey);
        var infoHtml = variantInfoHtmlForCard(product, chosen, interactivePositions);
        if (infoEl) {
          infoEl.innerHTML = infoHtml;
          infoEl.style.display = infoHtml ? "block" : "none";
        }

        interactivePositions.forEach(function (pos) {
          var sel = root.querySelector('.finder-variant-opt[data-opt-pos="' + pos + '"]');
          if (!sel) return;
          var allowed = valuesForInteractiveOption(product, interactivePositions, pos, selections);
          var current = selections[pos];
          sel.innerHTML = allowed
            .map(function (val) {
              var isSel = val === current ? "selected" : "";
              return '<option value="' + escapeHtml(val) + '" ' + isSel + ">" + escapeHtml(val) + "</option>";
            })
            .join("");
        });
      }

      interactivePositions.forEach(function (pos) {
        var sel = root.querySelector('.finder-variant-opt[data-opt-pos="' + pos + '"]');
        if (!sel) return;
        sel.addEventListener("change", function () {
          selections[pos] = sel.value;
          sync();
        });
      });

      sync();
    }
    //It retrieves the currently selected variant ID from a product card using its stored dataset value, which is updated whenever the user changes variant options. This allows the "Add to Cart" and "Buy Now" buttons to know which specific variant to add or purchase based on the user's current selections
    function getCardVariantId(cardKey) {
      var scope = resultsScope();
      if (!scope) return "";
      var root = scope.querySelector('[data-variant-root="' + cardKey + '"]');
      if (!root || !root.dataset.currentVariantId) return "";
      return root.dataset.currentVariantId;
    }

    //render products- What product list should appear on screen -initial load(empty msg), No result(no match msg), or filtered products
    function render(products, isInitial) {
      var container = resultsScope();
      var empty = document.getElementById("empty-state-" + sectionId);
      if (!container || !empty) return;

      if (isInitial) {
        container.innerHTML = "";
        empty.innerText = defaultEmptyMessage;
        empty.classList.remove("no-match");
        empty.style.display = "block";
        return;
      }

      if (!products.length) {
        container.innerHTML = "";
        empty.innerText = noMatchMessage;
        empty.classList.add("no-match");
        empty.style.display = "block";
        return;
      }

      empty.classList.remove("no-match");
      empty.style.display = "none";

      container.innerHTML = products
        .map(function (p, i) {
          return renderDynamicCard(p, cardKeyForIndex(i));
        })
        .join("");

      products.forEach(function (p, i) {
        initDynamicVariantCard(cardKeyForIndex(i), p);
      });
    }

   //cart overlay- “please wait…” screen when someone adds to cart or clicks buy now
    (function ensureOverlayApi() {
      if (window.__finderCartPageOverlayApi) return;
      window.__finderCartPageOverlayApi = true;

      function ensureOverlay() {
        var root = document.getElementById("finder-cart-page-overlay");
        if (!root) {
          root = document.createElement("div");
          root.id = "finder-cart-page-overlay";
          root.className = "finder-cart-page-overlay";
          root.setAttribute("hidden", "");
          root.innerHTML =
            '<div class="finder-cart-page-overlay__backdrop" aria-hidden="true"></div>' +
            '<div class="finder-cart-page-overlay__panel" role="status" aria-live="polite" aria-busy="true">' +
            '<span class="finder-cart-page-overlay__spinner" aria-hidden="true"></span>' +
            '<span class="finder-cart-page-overlay__label">Please wait…</span>' +
            "</div>";
          document.body.appendChild(root);
        }
        return root;
      }

      window.showFinderCartPageOverlay = function (message) {
        var root = ensureOverlay();
        var label = root.querySelector(".finder-cart-page-overlay__label");
        if (label && message) label.textContent = message;
        root.removeAttribute("hidden");
        requestAnimationFrame(function () {
          root.classList.add("is-visible");
        });
        document.documentElement.classList.add("finder-cart-overlay-open");
      };

      window.hideFinderCartPageOverlay = function () {
        var root = document.getElementById("finder-cart-page-overlay");
        if (!root) return;
        root.classList.remove("is-visible");
        root.setAttribute("hidden", "");
        document.documentElement.classList.remove("finder-cart-overlay-open");
      };

      window.beginFinderCartRequest = function (message) {
        if (window.__finderCartRequestActive) return false;
        window.__finderCartRequestActive = true;
        window.showFinderCartPageOverlay(message);
        return true;
      };

      window.endFinderCartRequest = function () {
        window.__finderCartRequestActive = false;
        window.hideFinderCartPageOverlay();
      };
    })();
    //fetches latest cart from Shopify, updates cart icon badge, updates all counters, notifies system that cart changed
    function refreshCartUI() {
      return fetch("/cart.js")
        .then(function (res) {
          return res.json();
        })
        .then(function (cart) {
          var count = cart.item_count;

          var cartLink = document.querySelector(".cart-icon");
          if (cartLink) {
            var badge = cartLink.querySelector(".cart-count");
            if (count > 0 && !badge) {
              badge = document.createElement("span");
              badge.className = "cart-count";
              cartLink.appendChild(badge);
            } else if (count <= 0 && badge) {
              badge.remove();
              badge = null;
            }
            if (badge) badge.textContent = String(count);
          }

          document.querySelectorAll(".cart-count, .cart-count-bubble, [data-cart-count]").forEach(function (el) {
            el.textContent = count;
            el.style.visibility = count > 0 ? "visible" : "hidden";
            el.style.opacity = count > 0 ? "1" : "0";
          });

          window.dispatchEvent(new CustomEvent("cart:refresh"));
          document.dispatchEvent(new CustomEvent("cart:refresh"));
          document.documentElement.dispatchEvent(new CustomEvent("cart:refresh"));
          window.dispatchEvent(new CustomEvent("cart:updated", { detail: cart }));
        });
    }
    //It shows a temporary message like “Added to cart”
    function showToast(msg) {
      var toast = document.getElementById("toast-" + sectionId);
      if (!toast) return;

      toast.innerText = msg;
      toast.style.opacity = 1;

      setTimeout(function () {
        toast.style.opacity = 0;
      }, 2000);
    }
    //Adds a selected product variant to Shopify cart using /cart/add.js API
    function addVariant(variantId) {
      var id = Number(variantId);
      if (!Number.isFinite(id) || id <= 0) {
        showToast("Invalid variant");
        return Promise.resolve(false);
      }

      return fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id, quantity: 1 }),
      }).then(function (res) {
        if (!res.ok) {
          showToast("Cannot add this product");
          return false;
        }
        return true;
      });
    }
    //manages the complete Add to Cart workflow including UI loading, API call, cart refresh, and success feedback
    function addToCart(variantId) {
      if (!window.beginFinderCartRequest("Adding to cart…")) return Promise.resolve();

      return addVariant(variantId)
        .then(function (ok) {
          if (!ok) return;
          return refreshCartUI().then(function () {
            showToast("Added to cart");
          });
        })
        .finally(function () {
          window.endFinderCartRequest();
        });
    }
    //Buy Now - direct checkout flow
    function buyNow(variantId) {
      if (!window.beginFinderCartRequest("Going to checkout…")) return Promise.resolve();

      return addVariant(variantId)
        .then(function (ok) {
          if (!ok) return;
          return refreshCartUI().then(function () {
            window.location.href = "/checkout";
          });
        })
        .finally(function () {
          window.endFinderCartRequest();
        });
    }
    //handles all Add to Cart and Buy Now clicks using event delegation
    function bindResultsCartDelegation() {
      var container = resultsScope();
      if (!container || container.dataset.cartDelegationBound === "1") return;
      container.dataset.cartDelegationBound = "1";
      container.addEventListener("click", function (e) {
        var addBtn = e.target.closest("[data-dynamic-add-cart]");
        var buyBtn = e.target.closest("[data-dynamic-buy-now]");
        if (addBtn) {
          e.preventDefault();
          if (window.__finderCartRequestActive) return;
          void addToCart(getCardVariantId(addBtn.getAttribute("data-card-key")));
        }
        if (buyBtn) {
          e.preventDefault();
          if (window.__finderCartRequestActive) return;
          void buyNow(getCardVariantId(buyBtn.getAttribute("data-card-key")));
        }
      });
    }
    function initFinder() {
      bindResultsCartDelegation();

      if (!data || data.length === 0) {
        console.warn("No products loaded");
        render([], true);
        updateCount(0);
        return;
      }

      render([], true);
      updateCount(0);
    }
    //connects buttons in HTML to JavaScript actions- when you click Apply, it applies filters; when you click Clear, it resets everything
    function bindButtons() {
      var applyBtn = document.getElementById("apply-" + sectionId);
      var clearBtn = document.getElementById("clear-" + sectionId);
      if (applyBtn) applyBtn.addEventListener("click", applyFilters);
      if (clearBtn) clearBtn.addEventListener("click", clearFilters);
    }

    bindButtons();
    initFinder();
  }
  //scans the DOM for all product finder sections and initializes each one using Shopify configuration data
  function initSectionsFromDom() {
    document.querySelectorAll("[data-dynamic-finder]").forEach(function (root) {
      var sid = root.getAttribute("data-section-id");
      if (!sid || root.getAttribute("data-dynamic-finder-mounted") === "true") return;

      var cfg = readFinderConfig(sid);
      if (!cfg) return;

      root.setAttribute("data-dynamic-finder-mounted", "true");
      mountFinder(cfg);
    });
  }
  //It decides whether to wait for the page to load or run immediately
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSectionsFromDom);
  } else {
    initSectionsFromDom();
  }
  //ensures your product finder re-initializes whenever Shopify dynamically reloads a section in the theme editor
  document.addEventListener("shopify:section:load", initSectionsFromDom);
})();
