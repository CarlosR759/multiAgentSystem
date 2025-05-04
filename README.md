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

## How to reproduce current error:
 Primero tienes que asegurarte que el .chat_app_messages.sqlite no existe como archivo. Cuando la base de datos sql lite se instancia, toma ese nombre.
 Asegurate de tenerla borrada siempre antes de depurar :)

 Luego instancia el backend con
 ```bash
uvicorn chat_app:app --reload --port 8000
 ```

Te va a generar el archivo .chat_app_messages.sqlite porque no hay ninguno, la bd esta vacia sin chat creado. El error se bypassea cuando logras poner un chat en la BD exitosamente.

Luego andate al browser y manda un mensaje, se va caer y vas encontrar un error 405, pero si vas a

```bash
localhost:8000/redoc
```

Te sale en el POST un error 422.

Puedes tambien mandarle consultas a la api tambien por:

```bash
localhost:8000/docs
```

Si mandas la query por localhost:8000/docs te deberia funcionar despues cualquier mensaje en el browser, hasta que borres el .chat_app_messages.sqlite.

puedes hacer tambien mandar un POST por curl asi:

```bash
curl -X POST "http://localhost:8000/chat/" -H "Content-type: application/x-www-form-urlencoded" --data-raw "prompt=Hello%20World"
```

Por lo tanto el problema solo ocurre cuando estas en el browser y quieres mandar el primer input al LLM :/
