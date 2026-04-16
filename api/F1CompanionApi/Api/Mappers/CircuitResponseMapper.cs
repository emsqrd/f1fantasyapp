using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;

namespace F1CompanionApi.Api.Mappers;

public static class CircuitResponseMapper
{
    public static CircuitResponse ToResponseModel(this Circuit circuit)
    {
        return new CircuitResponse
        {
            Id = circuit.Id,
            Name = circuit.Name,
            Location = circuit.Location,
            Country = circuit.Country,
        };
    }
}
