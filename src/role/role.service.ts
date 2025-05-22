import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaginationEnum } from 'src/common/constants/constants.enum';
import { PaginationDTO } from 'src/common/dto/common.dto';
import { SearchFilterDto } from './dto/create-role.dto';

@Injectable()
export class RoleService {
    constructor(
        @InjectModel('Role') private readonly rolesModel: Model<any>,
    ) { }

    async findAll(PaginationDTO: PaginationDTO): Promise<any> {
        var Offset = PaginationDTO.offset
            ? Number(PaginationDTO.offset)
            : PaginationEnum.OFFSET;
        var limit = PaginationDTO.limit
            ? Number(PaginationDTO.limit)
            : PaginationEnum.NO_LIMIT;

        const search = PaginationDTO?.search ? PaginationDTO?.search.trim() : null;

        const options = {};

        if (search) {
            options['$or'] = [
                { name: { $regex: search ? search : '', $options: 'i' } },
                { description: { $regex: search ? search : '', $options: 'i' } },
            ];
        }

        const count = await this.rolesModel.find(options).countDocuments();

        const result = await this.rolesModel
            .find(options)
            .skip(Offset)
            .limit(limit);

        return {
            result,
            pagination: {
                offset: Offset,
                limit: limit,
                total: count,
            },
        };
    }

    async findAllList(
        data: SearchFilterDto,
        PaginationDTO: PaginationDTO,
    ): Promise<any> {

        const options = {
            isDeleted: false,
            //   $and: [data?.roleType ? { roleType: data?.roleType } : {}],
        };
        const result = await this.rolesModel.find(options).select('name _id');

        return result;
    }


}
