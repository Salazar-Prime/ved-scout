(function () {
  "use strict";

  const data = window.EXPERIMENT_DATA;
  if (!data) {
    document.body.insertAdjacentHTML(
      "afterbegin",
      '<p class="data-error">Experiment data could not be loaded. Rebuild <code>docs/assets/experiment-data.js</code>.</p>',
    );
    return;
  }

  const tierOrder = { easy: 0, medium: 1, hard: 2 };
  const plotState = {
    difficulty: "easy",
    viewBy: "model",
    trial: data.trials.find((trial) => trial.difficulty === "easy") ?? data.trials[0],
  };

  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const titleCase = (value) =>
    String(value ?? "").replace(/(^|\s)\S/g, (character) => character.toUpperCase());

  const naturalRunCompare = (left, right) =>
    Number(left.replace(/\D/g, "")) - Number(right.replace(/\D/g, ""));

  function setPressed(container, value) {
    container.querySelectorAll("button").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.value === value));
    });
  }

  function setHeroStats() {
    const values = {
      questions: data.questions.length,
      asr: data.asr.length,
      trials: data.trials.length,
    };
    document.querySelectorAll("[data-stat]").forEach((element) => {
      element.textContent = values[element.dataset.stat] ?? "—";
    });

    const generatedDate = new Date(data.generatedAt);
    document.getElementById("generated-date").textContent = Number.isNaN(
      generatedDate.getTime(),
    )
      ? "from repository sources"
      : generatedDate.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
  }

  function trialDimension(trial, dimension) {
    return dimension === "model" ? trial.model : trial.run;
  }

  function dimensionLabel(value, dimension) {
    if (dimension === "run") {
      const number = value.replace(/\D/g, "");
      return `Run ${number || value}`;
    }
    return value;
  }

  function getDifficultyTrials() {
    return data.trials.filter((trial) => trial.difficulty === plotState.difficulty);
  }

  function chooseDifficulty(difficulty) {
    const nextTrials = data.trials.filter((trial) => trial.difficulty === difficulty);
    const closest =
      nextTrials.find(
        (trial) =>
          trial.model === plotState.trial.model && trial.run === plotState.trial.run,
      ) ?? nextTrials[0];
    if (!closest) return;
    plotState.difficulty = difficulty;
    plotState.trial = closest;
    renderPlotExplorer();
  }

  function choosePrimary(value) {
    const secondaryDimension = plotState.viewBy === "model" ? "run" : "model";
    const currentSecondary = trialDimension(plotState.trial, secondaryDimension);
    const candidates = getDifficultyTrials().filter(
      (trial) => trialDimension(trial, plotState.viewBy) === value,
    );
    plotState.trial =
      candidates.find(
        (trial) => trialDimension(trial, secondaryDimension) === currentSecondary,
      ) ?? candidates[0];
    renderPlotExplorer();
  }

  function renderPlotControls() {
    const trials = getDifficultyTrials();
    const primaryDimension = plotState.viewBy;
    const secondaryDimension = primaryDimension === "model" ? "run" : "model";
    const currentPrimary = trialDimension(plotState.trial, primaryDimension);

    const primaryValues = [...new Set(trials.map((trial) => trialDimension(trial, primaryDimension)))];
    if (primaryDimension === "run") primaryValues.sort(naturalRunCompare);

    const primaryControl = document.getElementById("primary-control");
    primaryControl.innerHTML = primaryValues
      .map(
        (value) => `
          <button
            type="button"
            data-value="${escapeHtml(value)}"
            aria-pressed="${value === currentPrimary}"
          >${escapeHtml(dimensionLabel(value, primaryDimension))}</button>
        `,
      )
      .join("");

    primaryControl.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => choosePrimary(button.dataset.value));
    });

    const secondaryTrials = trials.filter(
      (trial) => trialDimension(trial, primaryDimension) === currentPrimary,
    );
    if (secondaryDimension === "run") {
      secondaryTrials.sort((left, right) => naturalRunCompare(left.run, right.run));
    }

    const secondaryControl = document.getElementById("secondary-control");
    secondaryControl.className = secondaryDimension === "model" ? "choice-stack" : "choice-grid";
    secondaryControl.innerHTML = secondaryTrials
      .map((trial) => {
        const baseLabel = dimensionLabel(
          trialDimension(trial, secondaryDimension),
          secondaryDimension,
        );
        const attemptLabel = trial.attempt > 1 ? ` · attempt ${trial.attempt}` : "";
        return `
          <button
            type="button"
            data-trial-id="${escapeHtml(trial.id)}"
            aria-pressed="${trial.id === plotState.trial.id}"
          >${escapeHtml(baseLabel + attemptLabel)}</button>
        `;
      })
      .join("");

    secondaryControl.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        const trial = data.trials.find((item) => item.id === button.dataset.trialId);
        if (!trial) return;
        plotState.trial = trial;
        renderPlotExplorer();
      });
    });

    document.getElementById("primary-label").textContent =
      primaryDimension === "model" ? "Model type" : "Run number";
    document.getElementById("secondary-label").textContent =
      secondaryDimension === "model" ? "Model type" : "Run number";
  }

  function coordinateProjection(trial) {
    const allCoordinates = [
      ...trial.points.map(([longitude, latitude]) => [longitude, latitude]),
      ...trial.boundary,
    ];
    const latitudes = allCoordinates.map((coordinate) => coordinate[1]);
    const longitudes = allCoordinates.map((coordinate) => coordinate[0]);
    const latitudeCenter =
      (Math.min(...latitudes) + Math.max(...latitudes)) / 2;
    const longitudeFactor = Math.cos((latitudeCenter * Math.PI) / 180);

    const projected = allCoordinates.map(([longitude, latitude]) => [
      longitude * longitudeFactor,
      latitude,
    ]);
    const xValues = projected.map((coordinate) => coordinate[0]);
    const yValues = projected.map((coordinate) => coordinate[1]);
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);
    const rangeX = Math.max(maxX - minX, 0.000001);
    const rangeY = Math.max(maxY - minY, 0.000001);

    const canvas = { width: 960, height: 560, paddingX: 76, paddingY: 62 };
    const innerWidth = canvas.width - canvas.paddingX * 2;
    const innerHeight = canvas.height - canvas.paddingY * 2;
    const scale = Math.min(innerWidth / rangeX, innerHeight / rangeY);
    const contentWidth = rangeX * scale;
    const contentHeight = rangeY * scale;
    const offsetX = canvas.paddingX + (innerWidth - contentWidth) / 2;
    const offsetY = canvas.paddingY + (innerHeight - contentHeight) / 2;

    const project = ([longitude, latitude]) => {
      const x = longitude * longitudeFactor;
      return [
        offsetX + (x - minX) * scale,
        canvas.height - (offsetY + (latitude - minY) * scale),
      ];
    };

    return {
      project,
      extent: {
        minLatitude: Math.min(...latitudes),
        maxLatitude: Math.max(...latitudes),
        minLongitude: Math.min(...longitudes),
        maxLongitude: Math.max(...longitudes),
      },
    };
  }

  function svgPointList(coordinates, project) {
    return coordinates
      .map((coordinate) => project(coordinate).map((value) => value.toFixed(2)).join(","))
      .join(" ");
  }

  function renderMap() {
    const trial = plotState.trial;
    const mapContent = document.getElementById("map-content");
    if (!trial?.points?.length) {
      mapContent.innerHTML = '<text x="480" y="280" text-anchor="middle" class="map-label">No coordinates in this trial</text>';
      return;
    }

    const { project, extent } = coordinateProjection(trial);
    const routePoints = svgPointList(trial.points, project);
    const boundaryPoints = svgPointList(trial.boundary, project);
    const start = project(trial.points[0]);
    const end = project(trial.points[trial.points.length - 1]);

    mapContent.innerHTML = `
      <polygon class="map-field" points="${boundaryPoints}" />
      <polyline class="map-route-halo" points="${routePoints}" />
      <polyline class="map-route" points="${routePoints}" />
      <circle class="map-point-start" cx="${start[0]}" cy="${start[1]}" r="7" />
      <circle class="map-point-end" cx="${end[0]}" cy="${end[1]}" r="7" />
    `;

    const extentText = `${extent.minLatitude.toFixed(6)}–${extent.maxLatitude.toFixed(
      6,
    )}° N · ${Math.abs(extent.maxLongitude).toFixed(6)}–${Math.abs(
      extent.minLongitude,
    ).toFixed(6)}° W`;
    document.getElementById("map-scale").textContent = extentText;

    document.getElementById("route-map-title").textContent =
      `${trial.model}, ${dimensionLabel(trial.run, "run")} flight route`;
    document.getElementById("route-map-description").textContent =
      `${trial.points.length} ordered waypoints from the ${trial.difficulty} plot KML. ` +
      `The amber marker is the first waypoint and the dark marker is the last.`;
  }

  function renderPlotReadout() {
    const trial = plotState.trial;
    const runLabel = dimensionLabel(trial.run, "run");
    document.getElementById("plot-kicker").textContent =
      `${titleCase(trial.difficulty)} plot · ${runLabel}` +
      (trial.attempt > 1 ? ` · attempt ${trial.attempt}` : "");
    document.getElementById("plot-name").textContent = trial.model;
    document.getElementById("metric-waypoints").textContent = trial.points.length.toLocaleString();
    document.getElementById("metric-duration").textContent =
      trial.duration === null ? "—" : `${trial.duration.toFixed(2)} s`;
    document.getElementById("metric-tokens").textContent =
      trial.outputTokens === null ? "—" : trial.outputTokens.toLocaleString();
    document.getElementById("metric-cost").textContent =
      trial.cost === null ? "—" : `$${trial.cost.toFixed(4)}`;

    const timestamp = trial.timestamp
      ? new Date(trial.timestamp).toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "timestamp not recorded";
    document.getElementById("plot-source-note").textContent =
      `Source folder: ${trial.sourceName} · ${timestamp}. Coordinates preserve the order and altitude values stored in the KML.`;
  }

  function renderPlotExplorer() {
    setPressed(document.getElementById("difficulty-control"), plotState.difficulty);
    setPressed(document.getElementById("view-control"), plotState.viewBy);
    renderPlotControls();
    renderMap();
    renderPlotReadout();
  }

  function initialisePlotControls() {
    document.querySelectorAll("#difficulty-control button").forEach((button) => {
      button.addEventListener("click", () => chooseDifficulty(button.dataset.value));
    });

    document.querySelectorAll("#view-control button").forEach((button) => {
      button.addEventListener("click", () => {
        plotState.viewBy = button.dataset.value;
        renderPlotExplorer();
      });
    });

    renderPlotExplorer();
  }

  function questionTemplate(question) {
    const followUps = question.followUps.length
      ? `<section>
          <h4>Follow-up turns</h4>
          <ol>${question.followUps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
        </section>`
      : `<section>
          <h4>Follow-up turns</h4>
          <p>No follow-up turn is specified for this prompt.</p>
        </section>`;
    const notes = question.notes
      ? `<p class="question-notes"><b>Notes:</b> ${escapeHtml(question.notes)}</p>`
      : "";

    return `
      <details
        class="question-card"
        data-tier="${escapeHtml(question.tier)}"
        data-search="${escapeHtml(
          [
            question.id,
            question.prompt,
            ...question.followUps,
            question.expectedCallSequence,
            question.notes,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase(),
        )}"
      >
        <summary>
          <span class="question-id">${escapeHtml(question.id)}<small>${escapeHtml(
            question.tier,
          )}</small></span>
          <span class="question-prompt">${escapeHtml(question.prompt)}</span>
          <span class="question-meta">
            <span>${question.totalSteps ?? "—"} ${question.totalSteps === 1 ? "step" : "steps"}</span>
            <span>${question.uniqueToolTypes ?? "—"} ${question.uniqueToolTypes === 1 ? "tool" : "tools"}</span>
          </span>
          <span class="question-toggle" aria-hidden="true"></span>
        </summary>
        <div class="question-body">
          ${followUps}
          <section>
            <h4>Expected call sequence</h4>
            <pre class="call-sequence">${escapeHtml(
              question.expectedCallSequence ?? "No expected call sequence recorded.",
            )}</pre>
            ${notes}
          </section>
        </div>
      </details>
    `;
  }

  function initialiseQuestions() {
    const list = document.getElementById("question-list");
    const questions = [...data.questions].sort((left, right) => {
      const tierDifference = tierOrder[left.tier] - tierOrder[right.tier];
      if (tierDifference) return tierDifference;
      return Number(left.id.replace(/\D/g, "")) - Number(right.id.replace(/\D/g, ""));
    });
    list.innerHTML = questions.map(questionTemplate).join("");

    const filter = document.getElementById("question-tier-filter");
    const search = document.getElementById("question-search");
    const count = document.getElementById("question-count");
    let selectedTier = "all";

    const applyFilters = () => {
      const query = search.value.trim().toLowerCase();
      let visibleCount = 0;
      list.querySelectorAll(".question-card").forEach((card) => {
        const tierMatches = selectedTier === "all" || card.dataset.tier === selectedTier;
        const searchMatches = !query || card.dataset.search.includes(query);
        card.hidden = !(tierMatches && searchMatches);
        if (!card.hidden) visibleCount += 1;
      });
      count.textContent = `Showing ${visibleCount} ${visibleCount === 1 ? "question" : "questions"}`;
      let empty = list.querySelector(".empty-state");
      if (visibleCount === 0 && !empty) {
        empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "No questions match this filter. Try a different tier or search term.";
        list.appendChild(empty);
      } else if (visibleCount > 0 && empty) {
        empty.remove();
      }
    };

    filter.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        selectedTier = button.dataset.value;
        setPressed(filter, selectedTier);
        applyFilters();
      });
    });
    search.addEventListener("input", applyFilters);
    applyFilters();
  }

  function asrTemplate(record) {
    return `
      <article class="asr-card" data-tier="${escapeHtml(record.tier)}">
        <div class="asr-identity">
          <b>${escapeHtml(record.id)}</b>
          <span class="tier-label">${escapeHtml(record.tier)}</span>
          <span class="asr-filename">${escapeHtml(record.file)}</span>
        </div>
        <div class="asr-copy">
          <h3>Ground truth</h3>
          <p>${escapeHtml(record.groundTruth)}</p>
        </div>
        <div class="asr-copy asr-response">
          <h3>Whisper response</h3>
          <p>${escapeHtml(record.response)}</p>
        </div>
        <dl class="asr-metrics">
          <div><dt>Status</dt><dd class="${record.status === "OK" ? "status-ok" : ""}">${escapeHtml(
            record.status ?? "—",
          )}</dd></div>
          <div><dt>Latency</dt><dd>${record.latency === null ? "—" : `${record.latency.toFixed(2)} s`}</dd></div>
          <div><dt>Audio</dt><dd>${
            record.audioDuration === null ? "—" : `${record.audioDuration.toFixed(2)} s`
          }</dd></div>
          <div><dt>Segments</dt><dd>${record.segments ?? "—"}</dd></div>
        </dl>
      </article>
    `;
  }

  function initialiseAsr() {
    const list = document.getElementById("asr-list");
    list.innerHTML = data.asr.map(asrTemplate).join("");
    const filter = document.getElementById("asr-tier-filter");

    filter.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        const selectedTier = button.dataset.value;
        setPressed(filter, selectedTier);
        list.querySelectorAll(".asr-card").forEach((card) => {
          card.hidden = selectedTier !== "all" && card.dataset.tier !== selectedTier;
        });
      });
    });
  }

  setHeroStats();
  initialisePlotControls();
  initialiseQuestions();
  initialiseAsr();
})();
