const { sanitizeFinalText, secondsToMins } = require("./commonHandlers");

class ContentStandardizer {

  standardizeResult(result, url, source = "unknown", mode = "structured", opts = { includeMetadata: true }) {
    if (!result || (Array.isArray(result) && result.length === 0)) return null;

    const contentArray = this._itemsToContentArrayForPosts(result);

    if (mode === "flatRaw") {
      return {
        source,
        content: this._flattenRaw(contentArray),
      };
    }

    if (mode === "flatWithRoles") {
      const metadata = opts.includeMetadata ? this._extractPostMetadata(result, url) : {};
      return {
        source,
        metadata,
        content: this._flattenWithRoles(contentArray, metadata),
      };
    }

    const metadata = opts.includeMetadata ? this._extractPostMetadata(result, url) : {};
    return {
      source,
      metadata,
      content: contentArray,
      flattened: {
        flatRaw: this._flattenRaw(contentArray),
        flatWithRoles: this._flattenWithRoles(contentArray, metadata),
      },
    };
  }

  standardizeVideo(videoData, url, source = "unknown", mode = "structured", opts = { includeMetadata: true }) {
    if (!videoData) return null;

    const contentArray = this._itemsToContentArrayForVideo(videoData);

    if (mode === "flatRaw") {
      return {
        source,
        content: this._flattenRaw(contentArray),
      };
    }

    if (mode === "flatWithRoles") {
      const metadata = opts.includeMetadata ? this._extractVideoMetadata(videoData, url) : {};
      return {
        source,
        metadata,
        content: this._flattenWithRoles(contentArray, metadata),
      };
    }

    const metadata = opts.includeMetadata ? this._extractVideoMetadata(videoData, url) : {};
    return {
      source,
      metadata,
      content: contentArray,
      flattened: {
        flatRaw: this._flattenRaw(contentArray),
        flatWithRoles: this._flattenWithRoles(contentArray, metadata),
      },
    };
  }


  _itemsToContentArrayForPosts(items) {
    const normalized = Array.isArray(items) ? items : [items];

    const contentArray = [];

    normalized.forEach(item => {
      if (item.content || item.text) {
        contentArray.push({
          type: "post",
          text: sanitizeFinalText(item.content || item.text),
        });
      }

      if (Array.isArray(item.comments)) {
        item.comments.forEach(c => {
          contentArray.push({
            type: "comment",
            text: sanitizeFinalText(c),
          });
        });
      }
    });

    return contentArray;
  }

  _itemsToContentArrayForVideo(videoData) {
    const transcriptItems = (videoData.transcript || []).map(seg => {
      const start = secondsToMins(seg.start);
      const end = secondsToMins(seg.start + seg.duration);
      const text = sanitizeFinalText(seg.text);
      return { type: "transcript", text: `[${start}-${end}] ${text}` };
    });

    const chatItems = (videoData.chat || []).map(msg => {
      const time = msg.timestamp ? `[${msg.timestamp}] ` : '';
      const author = msg.author ? `[${sanitizeFinalText(msg.author)}] ` : '';
      const text = sanitizeFinalText(msg.text || msg.message || '');
      return { type: "chat", text: `${time}${author}${text}` };
    });

    return [
      { type: "title", text: videoData.title ? sanitizeFinalText(videoData.title) : "" },
      { type: "description", text: videoData.description ? sanitizeFinalText(videoData.description) : "" },
      { type: "channel", text: videoData.channel ? sanitizeFinalText(videoData.channel) : "" },
      ...transcriptItems,
      ...chatItems,
    ].filter(item => item.text && item.text.trim());
  }


  _extractPostMetadata(itemOrArray, url) {
    // first item as "main post"
    const item = Array.isArray(itemOrArray) ? itemOrArray[0] : itemOrArray;

    return {
      title: item.title || item.headline || "Untitled",
      author: item.author || "",
      publishedAt: item.created || item.date || null,
      url: item.url || url,
      score: item.score ?? 0,
      description: item.description || item.summary || "",
    };
  }

  _extractVideoMetadata(videoData, url) {
    return {
      title: videoData.title || "Untitled Video",
      channel: videoData.channel || "",
      publishedAt: videoData.date || null,
      startedAt: videoData.startedAt || null,
      duration: videoData.duration || null,
      live: videoData.live || null,
      url: videoData.url || url,
      views: videoData.views ?? 0,
      description: videoData.description || "",
    };
  }

  _flattenRaw(contentArray) {
    return contentArray.map(c => c.text).join(" ");
  }

  _flattenWithRoles(contentArray, metadata = {}) {
    let header = "";
    if (metadata.title) header += `[TITLE] ${sanitizeFinalText(metadata.title)} `;
    if (metadata.channel) header += `[CHANNEL] ${sanitizeFinalText(metadata.channel)} `;
    if (metadata.author) header += `[AUTHOR] ${sanitizeFinalText(metadata.author)} `;
    if (metadata.description) header += `[DESCRIPTION] ${sanitizeFinalText(metadata.description)} `;
    if (metadata.startedAt) header += `[STARTED_AT] ${metadata.startedAt}`;
    if (metadata.publishedAt) header += `[PUBLISHED_AT] ${metadata.publishedAt}`

    const hasTranscripts = contentArray.some(c => c.type === "transcript");

    let body = "";
    if (hasTranscripts) {
      body = contentArray
        .filter(c => c.type === "transcript")
        .map((c, idx) => (idx === 0 ? `[TRANSCRIPT] ${c.text}` : c.text))
        .join(" ");
    } else {
      body = contentArray
        .map(c => `[${c.type.toUpperCase()}] ${c.text}`)
        .join(" ");
    }

    return `${header}${body}`.trim();
  }



  async *streamTranscript(videoData) {
    const segments = this._itemsToContentArrayForVideo(videoData);
    for (const seg of segments) {
      yield sanitizeFinalText(seg.text);
    }
  }
}

module.exports = ContentStandardizer;
