import React, { useEffect, useState } from "react";
import { getParseInline } from "roamjs-components/marked";
import getRoamUrl from "roamjs-components/dom/getRoamUrl";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import getPageTitleByBlockUid from "roamjs-components/queries/getPageTitleByBlockUid";

// Resolves the page/block links Roam markup can contain back into graph-aware
// hrefs and referenced text, so a popup renders live links rather than raw
// `[[...]]`/`((...))` source.
const roamContext = {
  pagesToHrefs: (page: string, ref?: string): string =>
    ref ? getRoamUrl(ref) : getRoamUrl(getPageUidByPageTitle(page)),
  blockReferences: (ref: string): { text: string; page: string } => ({
    text: getTextByBlockUid(ref),
    page: getPageTitleByBlockUid(ref),
  }),
  components: (): false => false,
};

/**
 * Render a node's label as parsed Roam inline markup. The parser loads
 * asynchronously, so the raw label shows until it resolves.
 */
const AliasPreview = ({ label }: { label: string }): JSX.Element => {
  const [html, setHtml] = useState(label);
  useEffect(() => {
    let active = true;
    getParseInline().then((parse) => {
      if (active) setHtml(parse(label, roamContext));
    });
    return () => {
      active = false;
    };
  }, [label]);
  return (
    <span
      className="roamjs-atlas-label"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default AliasPreview;
