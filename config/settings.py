from pydantic import field_validator
from pydantic_settings import BaseSettings

_ARCGIS_MAPSERVER_URLS = {
    "NIFC_OUTLOOK_7DAY_URL":  "https://fsapps.nwcg.gov/psp/arcgis/rest/services/npsg/outlooks_forecast/MapServer",
    "NIFC_OUTLOOK_MONTHLY_URL": "https://fsapps.nwcg.gov/psp/arcgis/rest/services/npsg/Outlooks_Monthly_Extended/MapServer",
    "NIFC_RAWS_URL": "https://fsapps.nwcg.gov/psp/arcgis/rest/services/npsg/PSA_GACC_KeyRAWS/MapServer",
}


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/exf_wildfire"
    ANTHROPIC_API_KEY: str = ""
    API_KEY: str = ""
    LOG_LEVEL: str = "INFO"
    MODEL_DIR: str = "models/artifacts"
    CLAUDE_MODEL: str = "claude-opus-4-6"

    # ArcGIS / NIFC fetch settings
    ARCGIS_MAX_RECORDS: int = 1000
    ARCGIS_REQUEST_TIMEOUT: int = 30

    # NIFC ArcGIS service URLs
    NIFC_OUTLOOK_7DAY_URL: str = _ARCGIS_MAPSERVER_URLS["NIFC_OUTLOOK_7DAY_URL"]
    NIFC_OUTLOOK_MONTHLY_URL: str = _ARCGIS_MAPSERVER_URLS["NIFC_OUTLOOK_MONTHLY_URL"]
    NIFC_RAWS_URL: str = _ARCGIS_MAPSERVER_URLS["NIFC_RAWS_URL"]

    model_config = {"env_file": ".env", "extra": "ignore"}

    @field_validator("NIFC_OUTLOOK_7DAY_URL", "NIFC_OUTLOOK_MONTHLY_URL", "NIFC_RAWS_URL")
    @classmethod
    def must_be_arcgis_mapserver(cls, v: str, info) -> str:
        if not v.rstrip("/").endswith("MapServer"):
            canonical = _ARCGIS_MAPSERVER_URLS.get(info.field_name, "")
            raise ValueError(
                f"{info.field_name} must be an ArcGIS MapServer URL ending in "
                f"'MapServer', got: {v!r}. "
                f"Correct value: {canonical!r}"
            )
        return v.rstrip("/")


settings = Settings()
