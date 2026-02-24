from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/exf_wildfire"
    ANTHROPIC_API_KEY: str = ""
    API_KEY: str = ""
    LOG_LEVEL: str = "INFO"
    MODEL_DIR: str = "models/artifacts"
    CLAUDE_MODEL: str = "claude-opus-4-5"

    # ArcGIS / NIFC fetch settings
    ARCGIS_MAX_RECORDS: int = 1000
    ARCGIS_REQUEST_TIMEOUT: int = 30

    # NIFC ArcGIS service URLs
    NIFC_OUTLOOK_7DAY_URL: str = "https://fsapps.nwcg.gov/psp/arcgis/rest/services/npsg/outlooks_forecast/MapServer"
    NIFC_OUTLOOK_MONTHLY_URL: str = "https://fsapps.nwcg.gov/psp/arcgis/rest/services/npsg/Outlooks_Monthly_Extended/MapServer"
    NIFC_RAWS_URL: str = "https://fsapps.nwcg.gov/psp/arcgis/rest/services/npsg/PSA_GACC_KeyRAWS/MapServer"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
