import { useEffect, useRef, useState } from 'react'

const SAMPLE_HTML = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 48px 28px; font-family: Arial, sans-serif; color: #1f2937; background: #f8fafc; }
    .card { max-width: 760px; margin: 0 auto; padding: 40px; background: white; border: 1px solid #dbe3ee; border-radius: 18px; box-shadow: 0 12px 36px rgba(15, 23, 42, .08); }
    h1 { margin: 0 0 16px; color: #163c8c; font-size: 32px; }
    p { margin: 0 0 24px; font-size: 17px; line-height: 1.8; }
    .notice { padding: 18px 20px; border-left: 5px solid #2563eb; background: #eff6ff; line-height: 1.7; }
  </style>
</head>
<body>
  <main class="card">
    <h1>화면에서 바로 수정해 보세요</h1>
    <p>이 문장을 클릭하면 코드가 아니라 실제 보이는 화면에서 텍스트를 편집할 수 있습니다.</p>
    <div class="notice"><strong>사용 방법</strong><br>왼쪽에 HTML을 붙여넣고 ‘화면에 적용’을 누르세요. 편집을 마친 뒤 ‘HTML 복사’를 누르면 됩니다.</div>
  </main>
</body>
</html>`

const ICONS = {
  code: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 9-3 3 3 3M16 9l3 3-3 3M14 5l-4 14"/></svg>',
  upload: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L7 9m5-5 5 5M5 15v4h14v-4"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
}

function Icon({ name }) {
  return <span className="icon" dangerouslySetInnerHTML={{ __html: ICONS[name] }} />
}

function App() {
  const [source, setSource] = useState(SAMPLE_HTML)
  const [previewHtml, setPreviewHtml] = useState(SAMPLE_HTML)
  const [fileName, setFileName] = useState('새 문서.html')
  const [status, setStatus] = useState('편집 준비됨')
  const [copied, setCopied] = useState(false)
  const [mobilePanel, setMobilePanel] = useState('preview')
  const iframeRef = useRef(null)
  const fileInputRef = useRef(null)
  const statusTimerRef = useRef(null)

  const announce = (message) => {
    setStatus(message)
    window.clearTimeout(statusTimerRef.current)
    statusTimerRef.current = window.setTimeout(() => setStatus('변경 내용 자동 반영 중'), 2200)
  }

  const serializePreview = () => {
    const documentNode = iframeRef.current?.contentDocument
    if (!documentNode?.documentElement) return source
    const doctype = documentNode.doctype ? '<!doctype html>\n' : ''
    return `${doctype}${documentNode.documentElement.outerHTML}`
  }

  const syncFromPreview = () => {
    setSource(serializePreview())
    setStatus('화면에서 수정됨')
  }

  const handleFrameLoad = () => {
    const documentNode = iframeRef.current?.contentDocument
    if (!documentNode) return
    documentNode.designMode = 'on'
    documentNode.addEventListener('input', syncFromPreview)
    documentNode.addEventListener('blur', syncFromPreview, true)
    setStatus('화면을 클릭해 직접 수정하세요')
  }

  useEffect(() => () => window.clearTimeout(statusTimerRef.current), [])

  useEffect(() => {
    const context = document.modelContext
    if (!context?.registerTool) return undefined
    const lifecycle = new AbortController()

    Promise.resolve(context.registerTool({
      name: 'stage_html_for_editing',
      title: 'HTML 편집 준비',
      description: 'HTML 문서를 코드 패널과 편집 화면에 불러옵니다.',
      inputSchema: {
        type: 'object',
        properties: {
          html: { type: 'string', description: '편집할 전체 HTML 문서' },
          fileName: { type: 'string', description: '표시할 파일 이름' },
        },
        required: ['html'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input) {
        if (!input || typeof input.html !== 'string' || !input.html.trim()) {
          throw new Error('비어 있지 않은 HTML 문자열이 필요합니다.')
        }
        setSource(input.html)
        setPreviewHtml(input.html)
        setFileName(typeof input.fileName === 'string' && input.fileName.trim() ? input.fileName : '가져온 문서.html')
        setMobilePanel('preview')
        setStatus('HTML을 불러왔습니다')
        return { status: 'ready', fileName: input.fileName || '가져온 문서.html' }
      },
    }, { signal: lifecycle.signal })).catch(() => {})

    return () => lifecycle.abort()
  }, [])

  const applySource = () => {
    setPreviewHtml(source)
    setMobilePanel('preview')
    announce('HTML을 화면에 적용했습니다')
  }

  const runCommand = (command, value = null) => {
    const documentNode = iframeRef.current?.contentDocument
    if (!documentNode) return
    documentNode.execCommand(command, false, value)
    documentNode.body?.focus()
    syncFromPreview()
  }

  const copyHtml = async () => {
    const html = serializePreview()
    setSource(html)
    try {
      await navigator.clipboard.writeText(html)
      setCopied(true)
      announce('수정된 HTML을 복사했습니다')
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setMobilePanel('source')
      announce('코드를 선택해 직접 복사해 주세요')
    }
  }

  const loadFile = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const html = String(reader.result)
      setSource(html)
      setPreviewHtml(html)
      setFileName(file.name)
      setMobilePanel('preview')
      announce(`${file.name}을 열었습니다`)
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  const downloadHtml = () => {
    const html = serializePreview()
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName || 'edited.html'
    link.click()
    URL.revokeObjectURL(url)
    announce('HTML 파일을 저장했습니다')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><Icon name="code" /></span>
          <div>
            <strong>HTML Previewer</strong>
            <span>보이는 화면에서 바로 수정</span>
          </div>
        </div>
        <div className="header-actions">
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept=".html,.htm,text/html"
            onChange={loadFile}
          />
          <button className="button ghost" onClick={() => fileInputRef.current?.click()}>
            <Icon name="upload" /> 파일 열기
          </button>
          <button className="button primary" onClick={copyHtml}>
            <Icon name={copied ? 'check' : 'copy'} /> {copied ? '복사 완료' : 'HTML 복사'}
          </button>
        </div>
      </header>

      <main className="workspace">
        <div className="mobile-tabs" role="tablist" aria-label="편집 화면 선택">
          <button className={mobilePanel === 'source' ? 'active' : ''} onClick={() => setMobilePanel('source')}>HTML 코드</button>
          <button className={mobilePanel === 'preview' ? 'active' : ''} onClick={() => setMobilePanel('preview')}>편집 화면</button>
        </div>

        <section className={`panel source-panel ${mobilePanel === 'source' ? 'mobile-active' : ''}`}>
          <div className="panel-heading">
            <div>
              <span className="eyebrow">SOURCE</span>
              <h1>HTML 코드</h1>
            </div>
            <button className="button compact" onClick={applySource}>화면에 적용</button>
          </div>
          <label className="visually-hidden" htmlFor="html-source">HTML 코드 입력</label>
          <textarea
            id="html-source"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            spellCheck="false"
            aria-describedby="source-help"
          />
          <p id="source-help" className="panel-help">HTML을 붙여넣은 뒤 화면에 적용하세요. 화면에서 고친 내용도 이곳에 반영됩니다.</p>
        </section>

        <section className={`panel preview-panel ${mobilePanel === 'preview' ? 'mobile-active' : ''}`}>
          <div className="panel-heading preview-heading">
            <div>
              <span className="eyebrow">LIVE EDIT</span>
              <h2>{fileName}</h2>
            </div>
            <div className="status" role="status"><span />{status}</div>
          </div>

          <div className="format-toolbar" aria-label="텍스트 서식 도구">
            <button title="실행 취소" onMouseDown={(event) => { event.preventDefault(); runCommand('undo') }}>↶</button>
            <button title="다시 실행" onMouseDown={(event) => { event.preventDefault(); runCommand('redo') }}>↷</button>
            <span className="separator" />
            <button className="bold" title="굵게" onMouseDown={(event) => { event.preventDefault(); runCommand('bold') }}>B</button>
            <button className="italic" title="기울임" onMouseDown={(event) => { event.preventDefault(); runCommand('italic') }}>I</button>
            <button className="underline" title="밑줄" onMouseDown={(event) => { event.preventDefault(); runCommand('underline') }}>U</button>
            <span className="separator" />
            <button title="왼쪽 정렬" onMouseDown={(event) => { event.preventDefault(); runCommand('justifyLeft') }}>≡</button>
            <button title="가운데 정렬" onMouseDown={(event) => { event.preventDefault(); runCommand('justifyCenter') }}>≣</button>
            <button title="글머리 목록" onMouseDown={(event) => { event.preventDefault(); runCommand('insertUnorderedList') }}>•≡</button>
            <span className="toolbar-note">아래 화면의 글자를 클릭해서 수정하세요</span>
          </div>

          <div className="canvas-wrap">
            <iframe
              ref={iframeRef}
              title="HTML 편집 화면"
              srcDoc={previewHtml}
              sandbox="allow-same-origin"
              onLoad={handleFrameLoad}
            />
          </div>

          <div className="preview-footer">
            <p>스크립트는 안전을 위해 실행되지 않습니다.</p>
            <button className="button ghost dark" onClick={downloadHtml}><Icon name="download" /> 파일로 저장</button>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
