function updateHash() {
  const hash = location.hash.substr(1).split("#");
  const pubId = hash[0];
  const langId = hash[1];
  console.log("try pubId", pubId, langId);
  loadPub(pubId, langId);
}
window.addEventListener("hashchange", updateHash);
updateHash();

/**
 * @param {string} pubId JW publication ID
 * @param {string} langId Language, like E (English), O (Dutch)
 */
async function loadPub(pubId, langId) {
  langId = langId || "E";
  const outputElement = document.getElementsByClassName("output")[0];
  // Clear element
  while (outputElement.firstChild) {
    outputElement.removeChild(outputElement.firstChild);
  }
  try {
    if (!pubId) {
      throw new Error("No hash");
    }
    const response = await fetch(
      `https://data.jw-api.org/mediator/v1/media-items/${langId}/${pubId}?clientType=tvjworg`
    );
    if (!response.ok) {
      throw new Error(`${response.url} status: ${response.statusText}`);
    }
    const json = await response.json();
    if (!json.media[0]) {
      throw new Error(`Video ${pubId} not found`);
    }
    const media = json.media[0];
    if (!media.files[0].subtitles) {
      throw new Error(`No subtitles`);
    }
    const vttUrl = media.files[0].subtitles.url;

    // Add title
    const title = document.createElement("h1");
    title.textContent = media.title;
    outputElement.appendChild(title);
    // Render text
    await renderText(vttUrl, outputElement);
  } catch (e) {
    outputElement.textContent = e.toString();
  }
}

/**
 * @param {Response} response
 * @return {Promise<{text: string; startTime: number; endTime: number}[]>}
 */
async function getCuesFromHttpResponse(response) {
  const input = await response.text();
  const parser = new WebVTT.Parser(window, WebVTT.StringDecoder());
  const result = [];
  return new Promise((resolve, reject) => {
    parser.onregion = region => {};
    parser.oncue = cue => {
      result.push(cue);
    };
    parser.onflush = () => {
      resolve(result);
    };
    parser.onparsingerror = e => {
      reject(e);
    };
    parser.parse(input);
    parser.flush();
  });
}

/**
 * @param {string} url VTT url
 * @param {Element} outputElement
 */
async function renderText(url, outputElement) {
  const cueLines = await getCuesFromHttpResponse(await fetch(url));
  cueLines
    // Find and mark pauses
    .map((current, i, arr) => {
      const previous = arr[i - 1];
      if (previous) {
        const timeSpan = current.startTime - previous.endTime;
        if (timeSpan > 0.1) {
          current.space = true;
        }
      }
      return current;
    })
    // Append line break on pauses
    .reduce((accumulator, currentValue, index) => {
      if (index == 0 || currentValue.space) {
        accumulator.push(currentValue);
      } else {
        const previous = accumulator.pop();
        previous.text += "\n" + currentValue.text;
        accumulator.push(previous);
        return accumulator;
      }
      return accumulator;
    }, [])
    .forEach(l => {
      // Time
      const format = n =>
        Math.floor(n)
          .toString()
          .padStart(2, "0");
      const minutes = format(l.startTime / 60);
      const seconds = format(l.startTime % 60);
      const timeTag = document.createElement("div");
      timeTag.setAttribute("data-time", l.startTime);
      timeTag.classList.add("timeTag");
      timeTag.textContent = minutes + ":" + seconds;
      // Text
      const p = document.createElement("div");
      p.classList.add("text");
      p.textContent = l.text;
      // Row
      const row = document.createElement("div");
      row.classList.add("row");
      row.appendChild(timeTag);
      row.appendChild(p);
      outputElement.appendChild(row);
    });
}
