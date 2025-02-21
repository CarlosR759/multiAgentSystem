// BIG FAT WARNING: to avoid the complexity of npm, this typescript is compiled in the browser
// there's currently no static type checking

interface ChatMessage {
    role: 'user' | 'model'
    timestamp: string
    content: string
}

declare const marked: {
    parse: (text: string) => string
}
declare const hljs: {
    highlightAll: () => void
}

const convElement = document.getElementById("conversation");

const promptInput = document.getElementById("prompt-input") as HTMLInputElement;
const spinner = document.getElementById("spinner");

class ChatApp {
    private conversation: HTMLElement
    private form: HTMLFormElement
    private input: HTMLInputElement
    private spinner: HTMLElement
    private error: HTMLElement
    private controller: AbortController | null = null
    private currentModelMessage: string = ''
    private messageBuffer: string = ''
    private isNearBottom: boolean = true
    private scrollThreshold: number = 100

    constructor() {
        this.conversation = document.getElementById('conversation') as HTMLElement
        this.form = document.getElementById('prompt-form') as HTMLFormElement
        this.input = document.getElementById('prompt-input') as HTMLInputElement
        this.spinner = document.getElementById('spinner') as HTMLElement
        this.error = document.getElementById('error') as HTMLElement

        // Ocultar el error al inicio
        this.hideError()
        
        // Agregar evento de scroll
        this.conversation.addEventListener('scroll', this.handleScroll.bind(this))
        
        this.initialize()
    }

    private handleScroll() {
        const { scrollTop, scrollHeight, clientHeight } = this.conversation;
        const newIsNearBottom = (scrollHeight - scrollTop - clientHeight) <= this.scrollThreshold;
        
        // Solo actualizamos si el valor ha cambiado
        if (this.isNearBottom !== newIsNearBottom) {
            this.isNearBottom = newIsNearBottom;
        }
    }

    private shouldScrollToBottom(): boolean {
        // Siempre hacer scroll si el mensaje es del usuario
        if (this.conversation.lastElementChild?.classList.contains('user')) {
            return true
        }
        return this.isNearBottom
    }

    private scrollToBottom(force: boolean = false) {
        if (force || this.shouldScrollToBottom()) {
            this.conversation.scrollTop = this.conversation.scrollHeight
        }
    }

    private async initialize() {
        try {
            const response = await fetch('/chat/');
            if (!response.ok) {
                throw new Error(`Error al cargar mensajes: ${response.status}`);
            }
            const text = await response.text();
            
            // Si no hay mensajes, es normal - continuar sin error
            if (!text.trim()) {
                return;
            }
            
            const messages = text
                .split('\n')
                .filter(Boolean)
                .map(line => {
                    try {
                        return JSON.parse(line) as ChatMessage;
                    } catch (e) {
                        return null;
                    }
                })
                .filter((m): m is ChatMessage => m !== null);

            messages.forEach((message) => this.appendMessage(message));
            this.scrollToBottom();

            // Configurar eventos
            this.form.addEventListener('submit', this.handleSubmit.bind(this));
            this.input.addEventListener('keydown', this.handleKeyDown.bind(this));
        } catch (e) {
            console.error('Error al inicializar el chat:', e);
            this.showError();
        }
    }

    private async handleSubmit(e: Event) {
        e.preventDefault()
        const prompt = this.input.value.trim()
        if (!prompt) return

        this.input.value = ''
        this.input.disabled = true
        this.showSpinner()
        this.hideError() // Ocultar error al enviar nuevo mensaje
        this.currentModelMessage = ''
        this.messageBuffer = ''
        
        // Forzar scroll al enviar un nuevo mensaje
        this.isNearBottom = true

        try {
            this.controller = new AbortController()
            const response = await fetch('/chat/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `prompt=${encodeURIComponent(prompt)}`,
                signal: this.controller.signal,
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            const reader = response.body?.getReader()
            if (!reader) throw new Error('No response body')

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                // Decodificar el chunk y agregarlo al buffer
                const chunk = new TextDecoder().decode(value)
                this.messageBuffer += chunk

                try {
                    // Intentar procesar mensajes completos del buffer
                    const lines = this.messageBuffer.split('\n')
                    
                    // Mantener la última línea en el buffer si está incompleta
                    this.messageBuffer = lines.pop() || ''

                    for (const line of lines) {
                        if (!line.trim()) continue

                        try {
                            const message = JSON.parse(line) as ChatMessage
                            if (message.role === 'user') {
                                this.appendMessage(message)
                            } else {
                                const cleanContent = this.cleanModelResponse(message.content)
                                if (cleanContent && cleanContent !== this.currentModelMessage) {
                                    this.currentModelMessage = cleanContent
                                    this.updateOrCreateModelMessage(cleanContent, message.timestamp)
                                }
                            }
                        } catch (e) {
                            console.warn('Error parsing message line:', line, e)
                        }
                    }
                } catch (e) {
                    console.warn('Error processing message chunk:', e)
                }
            }

            // Procesar cualquier mensaje restante en el buffer
            if (this.messageBuffer.trim()) {
                try {
                    const message = JSON.parse(this.messageBuffer) as ChatMessage
                    if (message.role === 'model') {
                        const cleanContent = this.cleanModelResponse(message.content)
                        if (cleanContent) {
                            this.updateOrCreateModelMessage(cleanContent, message.timestamp)
                        }
                    }
                } catch (e) {
                    console.warn('Error processing final buffer:', e)
                }
            }

        } catch (e) {
            if (e.name === 'AbortError') {
                console.log('Request cancelled')
            } else {
                console.error('Error sending message:', e)
                this.showError()
            }
        } finally {
            this.hideSpinner()
            this.input.disabled = false
            this.input.focus()
            this.controller = null
            this.messageBuffer = ''
        }
    }

    private processModelContent(content: string): string {
        // Primero procesamos el contenido think
        const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
        const thinkContent = thinkMatch ? thinkMatch[1].trim() : '';
        
        // Removemos las etiquetas think del contenido principal
        let mainContent = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        
        // Convertimos el contenido principal a Markdown
        mainContent = marked.parse(mainContent);
        
        // Si hay contenido think, lo agregamos al final
        if (thinkContent) {
            const processedThink = marked.parse(thinkContent);
            mainContent += `\n<div class="think-content collapsed"><div class="think-toggle">▶</div>${processedThink}</div>`;
        }
        
        return mainContent;
    }

    private cleanModelResponse(content: string): string {
        if (!content) return ''
        
        try {
            // Eliminar líneas duplicadas que empiezan igual
            const lines = content.split('\n')
            const uniqueLines = lines.filter((line, index) => {
                if (!line.trim()) return false
                for (let i = 0; i < index; i++) {
                    if (lines[i].trim().startsWith(line.trim())) return false
                }
                return true
            })
            
            return uniqueLines.join('\n').trim()
        } catch (e) {
            console.warn('Error cleaning model response:', e)
            return content.trim()
        }
    }

    private updateOrCreateModelMessage(content: string, timestamp: string) {
        if (!content) return

        try {
            const lastMessage = this.conversation.querySelector('.model:last-child')
            if (lastMessage) {
                const contentEl = lastMessage.querySelector('.message-content')
                if (contentEl) {
                    const processedContent = this.processModelContent(content)
                    contentEl.innerHTML = processedContent
                    this.setupThinkContent(contentEl)
                    hljs.highlightAll()
                    this.scrollToBottom()
                    return
                }
            }

            this.appendMessage({
                role: 'model',
                content,
                timestamp
            })
        } catch (e) {
            console.warn('Error updating model message:', e)
        }
    }

    private setupThinkContent(container: Element) {
        const thinkContent = container.querySelector('.think-content')
        if (thinkContent) {
            thinkContent.addEventListener('click', () => {
                thinkContent.classList.toggle('collapsed')
                const toggle = thinkContent.querySelector('.think-toggle')
                if (toggle) {
                    toggle.textContent = thinkContent.classList.contains('collapsed') ? '▶' : '▼'
                }
            })
        }
    }

    private handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            this.form.requestSubmit()
        } else if (e.key === 'Enter' && e.shiftKey) {
            // Permitir nueva línea con Shift+Enter
            return
        }
    }

    private appendMessage(message: ChatMessage) {
        const messageDiv = document.createElement('div')
        messageDiv.className = `message ${message.role}`

        const header = document.createElement('div')
        header.className = 'message-header'
        header.textContent = message.role === 'user' ? 'Tú' : 'Asistente AI'
        messageDiv.appendChild(header)

        const content = document.createElement('div')
        content.className = 'message-content'
        
        if (message.role === 'model') {
            const processedContent = this.processModelContent(message.content)
            content.innerHTML = processedContent
            this.setupThinkContent(content)
            setTimeout(() => hljs.highlightAll(), 0)
        } else {
            content.textContent = message.content
        }
        
        messageDiv.appendChild(content)

        const timestamp = document.createElement('div')
        timestamp.className = 'message-timestamp'
        timestamp.textContent = new Date(message.timestamp).toLocaleTimeString()
        messageDiv.appendChild(timestamp)

        this.conversation.appendChild(messageDiv)
        // Forzar scroll solo para mensajes del usuario
        this.scrollToBottom(message.role === 'user')
    }

    private showSpinner() {
        this.spinner.classList.add('active')
    }

    private hideSpinner() {
        this.spinner.classList.remove('active')
    }

    private showError() {
        if (this.error) {
            this.error.classList.add('visible')
            // Auto-ocultar el error después de 5 segundos
            setTimeout(() => this.hideError(), 5000)
        }
    }

    private hideError() {
        if (this.error) {
            this.error.classList.remove('visible')
        }
    }
}

// Inicializar la aplicación
new ChatApp()
