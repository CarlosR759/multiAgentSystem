# Local Agent

![Preview](/.github/appPreview.gif)

Full stack web app to interact with large language models, currently in progress.

This is how to install it:

### First create Python virt env:
```bash
python -m venv <multiAgentSystem>
```
Or you can just use this if you don't want to create a new folder:
```bash
python -m venv .
```
### Go to your virt env in your "multiAgentSytem" folder:
#### Unix
```bash
source bin/activate
```
#### Windows with PS:
```bash
<multiAgentSystem>\Scripts\Activate.ps1
```
### Then use the requirements.txt to download from pip the packages needed:
```bash
pip install -r requirements.txt
```
### launch Ollama service if you haven't by command line:
```bash
ollama serve
```

### Configure the LLM model
Set the model using an environment variable before running the application:
```bash
# Example with llama
export MODEL_NAME=ollama:llama3:8b
python chat_app.py

# Example with deepseek
export MODEL_NAME=ollama:deepseek-r1:8b
python chat_app.py
```

Available model formats:
- `ollama:<model-name>`
- `openai:<model-name>`
- `anthropic:<model-name>`

### Then Run the python script
```bash
uvicorn chat_app:app --reload --port 8000
```
After that you can access the application going to your browser with:
```bash
localhost:8000
```
