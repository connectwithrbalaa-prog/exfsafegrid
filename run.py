import logging
import uvicorn
from config.settings import settings

if __name__ == "__main__":
    logging.basicConfig(
        level=getattr(logging, settings.LOG_LEVEL, logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=False)
